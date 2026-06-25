"""快递查询服务 - 基于快递100 API"""
import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Optional

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

# 快递100 API 状态码映射
STATUS_MAP = {
    "0": "运输中",
    "1": "运输中",
    "2": "运输中",
    "3": "运输中",
    "4": "派送中",
    "5": "已签收",
    "6": "查询失败",
    "7": "查询失败",
    "8": "未发货",
}

# 基于单号规则的本地识别规则（API识别失败时的后备方案）
# 格式: (正则表达式, 快递公司编码, 快递公司名称)
CARRIER_PATTERNS = [
    # 申通快递: 77/88开头的12-15位纯数字，或 STO 开头
    (r"^(77|88)\d{10,13}$", "shentong", "申通快递"),
    (r"^STO\d+$", "shentong", "申通快递"),
    # 顺丰速运: SF 开头
    (r"^SF\d+$", "shunfeng", "顺丰速运"),
    # 中通快递: 73/75/76开头，或 ZTO 开头
    (r"^(73|75|76)\d{10,13}$", "zhongtong", "中通快递"),
    (r"^ZTO\d+$", "zhongtong", "中通快递"),
    # 韵达快递: 多种数字开头的12-15位数字，或 YD/YUND 开头（必须在圆通之前）
    (r"^(10|12|13|15|16|17|19)\d{10,13}$", "yunda", "韵达快递"),
    (r"^(31|33|35)\d{10,13}$", "yunda", "韵达快递"),
    (r"^(43|44|45|46|47|48|49)\d{10,13}$", "yunda", "韵达快递"),
    (r"^YD\d+$", "yunda", "韵达快递"),
    (r"^YUND\d+$", "yunda", "韵达快递"),
    # 圆通速递: YT 开头，或 1 开头但第二位不是0的12-15位数字
    (r"^YT\d+$", "yuantong", "圆通速递"),
    (r"^1[1-9]\d{10,13}$", "yuantong", "圆通速递"),
    # 京东快递: JD/JDVA 开头
    (r"^JD(VA|X|Y|V)?\d+$", "jd", "京东快递"),
    # 极兔速递: JT 开头
    (r"^JT\d+$", "jtexpress", "极兔速递"),
    # EMS: E 开头 + 单号 + CN 结尾，或 EMS 开头
    (r"^E\d{9}[A-Z]{2}$", "ems", "EMS"),
    (r"^EMS\d+$", "ems", "EMS"),
    # 邮政包裹: 99/98/97/96/95/94开头的11-14位数字
    (r"^(99|98|97|96|95|94)\d{9,12}$", "youzhengguonei", "邮政包裹"),
]


def detect_carrier_local(tracking_number: str) -> tuple[str, str]:
    """通过单号规则本地识别快递公司（API识别失败时的后备方案）

    Args:
        tracking_number: 快递单号

    Returns:
        (carrier_code, carrier_name) 或 ("unknown", "未知快递")
    """
    num = tracking_number.strip().upper()
    for pattern, code, name in CARRIER_PATTERNS:
        if re.match(pattern, num):
            logger.info(f"本地规则识别: {tracking_number} -> {name} ({code})")
            return (code, name)
    return ("unknown", "未知快递")


async def detect_carrier(tracking_number: str) -> tuple[str, str]:
    """自动识别快递公司（先调用API，失败则使用本地规则）

    Args:
        tracking_number: 快递单号

    Returns:
        (carrier_code, carrier_name)
    """
    settings = get_settings()

    # 1. 尝试通过快递100 API 识别
    if settings.KUAIDI100_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.kuaidi100.com/autonumber/auto",
                    params={"num": tracking_number, "key": settings.KUAIDI100_KEY},
                )
                data = resp.json()
                if data and isinstance(data, list) and len(data) > 0:
                    com_code = data[0].get("comCode", "")
                    com_name = data[0].get("comName", com_code)
                    if com_code:
                        logger.info(f"快递100识别: {tracking_number} -> {com_name} ({com_code})")
                        return (com_code, com_name)
        except Exception as e:
            logger.warning(f"快递100自动识别失败: {e}")
    else:
        logger.warning("未配置 KUAIDI100_KEY，跳过API识别")

    # 2. API识别失败，使用本地规则识别
    result = detect_carrier_local(tracking_number)
    if result[0] != "unknown":
        return result

    # 3. 都无法识别
    return ("unknown", "未知快递")


async def _call_kuaidi100(carrier_code: str, tracking_number: str, settings, phone: str | None = None) -> dict:
    """调用快递100 API 查询（内部方法，尝试多个端点）

    Args:
        carrier_code: 快递公司编码
        tracking_number: 快递单号
        settings: 应用配置

    Returns:
        API 原始响应 dict
    """
    # 构建签名：param + key + customer -> MD5 -> 大写
    param_dict = {"com": carrier_code, "num": tracking_number, "show": "0", "order": "desc"}
    if phone:
        param_dict["phone"] = phone
    param = json.dumps(param_dict)
    sign_str = param + settings.KUAIDI100_KEY + settings.KUAIDI100_CUSTOMER
    sign = hashlib.md5(sign_str.encode("utf-8")).hexdigest().upper()

    logger.info(f"查询快递: {carrier_code} {tracking_number}")
    logger.info(f"customer: {settings.KUAIDI100_CUSTOMER}")
    logger.info(f"sign: {sign}")

    # 候选端点（优先使用 poll 端点，api 端点作为备选）
    endpoints = [
        "https://poll.kuaidi100.com/poll/query.do",
        "https://api.kuaidi100.com/api",
    ]

    async with httpx.AsyncClient(timeout=15.0) as client:
        for endpoint in endpoints:
            try:
                logger.info(f"尝试端点: {endpoint}")
                resp = await client.post(
                    endpoint,
                    data={
                        "customer": settings.KUAIDI100_CUSTOMER,
                        "sign": sign,
                        "param": param,
                    },
                )

                logger.info(f"响应状态码: {resp.status_code}")
                logger.info(f"Content-Type: {resp.headers.get('content-type', 'N/A')}")
                logger.info(f"响应前200字符: {resp.text[:200]}")

                # 检查是否为 JSON
                try:
                    data = resp.json()
                    api_status = data.get("status", "")
                    logger.info(f"JSON 解析成功，status={api_status}")

                    # status 为 "200" 表示查询成功，直接返回
                    if api_status == "200":
                        return data

                    # status 为 "0" 通常表示参数错误，尝试下一个端点
                    if api_status == "0":
                        logger.warning(f"端点 {endpoint} 返回错误: {data.get('message', '')}，尝试下一个")
                        continue

                    # 其他状态也返回，让调用方处理
                    return data
                except Exception:
                    logger.warning(f"端点 {endpoint} 返回非JSON，尝试下一个")
                    continue

            except httpx.TimeoutException:
                logger.warning(f"端点 {endpoint} 超时")
                continue
            except Exception as e:
                logger.warning(f"端点 {endpoint} 异常: {e}")
                continue

    # 所有端点都失败
    return {"status": "error", "message": "所有API端点均不可用"}


async def query_tracking(carrier_code: str, tracking_number: str, phone: str | None = None) -> dict:
    """查询快递物流信息

    Args:
        carrier_code: 快递公司编码
        tracking_number: 快递单号

    Returns:
        {
            "status": "运输中",
            "last_update": "最新物流信息",
            "tracking_info": [{"time": "...", "context": "..."}]
        }
    """
    settings = get_settings()

    if not settings.KUAIDI100_CUSTOMER or not settings.KUAIDI100_KEY:
        return {
            "status": "查询失败",
            "last_update": "未配置快递100 API Key，请在 .env 中设置 KUAIDI100_CUSTOMER 和 KUAIDI100_KEY",
            "tracking_info": [],
        }

    try:
        data = await _call_kuaidi100(carrier_code, tracking_number, settings, phone)

        if data.get("status") == "200":
            traces = data.get("data", [])
            status_code = data.get("state", "0")
            status = STATUS_MAP.get(status_code, "运输中")

            # 如果有物流信息，更新状态
            if traces:
                latest = traces[0]
                last_update = f"{latest.get('time', '')} {latest.get('context', '')}"
                # 根据最新物流内容判断状态
                ctx = latest.get("context", "")
                if "签收" in ctx or "已取" in ctx or "代收" in ctx or "收件" in ctx:
                    status = "已签收"
                elif "派送" in ctx or "派件" in ctx or "正在派送" in ctx:
                    status = "派送中"
                else:
                    # 有物流信息但不是签收/派送，说明在运输中
                    status = "运输中"
            else:
                # 没有物流信息，说明未发货
                status = "未发货"
                last_update = "暂无物流信息"

            tracking_info = [
                {"time": t.get("time", ""), "context": t.get("context", "")}
                for t in traces
            ]

            return {
                "status": status,
                "last_update": last_update,
                "tracking_info": tracking_info,
            }
        else:
            error_msg = data.get("message", data.get("status", "查询失败"))
            return {
                "status": "查询失败",
                "last_update": f"API返回: {error_msg}",
                "tracking_info": [],
            }

    except Exception as e:
        logger.error(f"快递查询异常: {e}", exc_info=True)
        return {
            "status": "查询失败",
            "last_update": f"查询异常: {str(e)}",
            "tracking_info": [],
        }


async def refresh_package_status(carrier_code: str, tracking_number: str, phone: str | None = None) -> dict:
    """刷新单个快递状态

    Args:
        carrier_code: 快递公司编码
        tracking_number: 快递单号

    Returns:
        查询结果字典（额外包含 carrier_code 和 carrier_name 字段，如果识别成功）
    """
    # 如果快递公司未知，尝试重新识别
    if carrier_code == "unknown":
        logger.info(f"快递公司未知，尝试重新识别: {tracking_number}")
        new_code, new_name = await detect_carrier(tracking_number)
        if new_code != "unknown":
            carrier_code = new_code
            logger.info(f"重新识别成功: {new_name} ({new_code})")
            # 查询并返回结果，附带识别出的快递公司信息
            result = await query_tracking(carrier_code, tracking_number, phone)
            result["carrier_code"] = new_code
            result["carrier_name"] = new_name
            return result
        else:
            return {
                "status": "查询失败",
                "last_update": "无法识别快递公司，请手动确认单号",
                "tracking_info": [],
            }
    return await query_tracking(carrier_code, tracking_number, phone)
