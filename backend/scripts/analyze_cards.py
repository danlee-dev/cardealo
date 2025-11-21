import json
import os

# 카드 데이터 로드
script_dir = os.path.dirname(os.path.abspath(__file__))
cards_path = os.path.join(script_dir, '../ai/cards.json')

with open(cards_path, 'r', encoding='utf-8') as f:
    cards_data = json.load(f)

# 3개 카드 분석 (사용자가 선택한 카드들)
target_cards = [
    "신한카드 The CLASSIC-Y",
    "신한카드 B.Big(삑)",
    "신한카드 Mr.Life"
]

print("="*100)
print("카드 데이터 상세 분석")
print("="*100)

for card_name in target_cards:
    if card_name not in cards_data:
        print(f"\n{card_name} - 데이터 없음")
        continue

    card = cards_data[card_name]

    print(f"\n{'='*100}")
    print(f"카드명: {card_name}")
    print(f"{'='*100}")
    print(f"브랜드: {', '.join(card.get('brand', []))}")
    print(f"전월실적: {card.get('pre_month_money', 0):,}원")
    print(f"혜택 항목 수: {len(card.get('key_benefit', []))}")

    print(f"\n[주요 혜택 분석]")
    for idx, benefit in enumerate(card.get('key_benefit', []), 1):
        print(f"\n--- 혜택 {idx} ---")
        print(f"전체 길이: {len(benefit)}자")

        # 첫 200자 표시
        preview = benefit[:200] + "..." if len(benefit) > 200 else benefit
        print(f"미리보기: {preview}")

        # 키워드 분석
        keywords = {
            '할인': '할인' in benefit,
            '적립': '적립' in benefit or '포인트' in benefit,
            '캐시백': '캐시백' in benefit,
            '스타벅스': '스타벅스' in benefit,
            '커피빈': '커피빈' in benefit,
            '편의점': '편의점' in benefit,
            '마트': '마트' in benefit or '이마트' in benefit or '롯데마트' in benefit or '홈플러스' in benefit,
            '백화점': '백화점' in benefit,
            '택시': '택시' in benefit,
            'GS칼텍스': 'GS칼텍스' in benefit or '주유' in benefit,
            '영화': '영화' in benefit or 'CGV' in benefit or '롯데시네마' in benefit or '메가박스' in benefit,
            '병원': '병원' in benefit or '약국' in benefit,
            '올리브영': '올리브영' in benefit,
            '통신요금': '통신요금' in benefit or '이동통신' in benefit,
            '전기요금': '전기요금' in benefit,
            '온라인': '온라인' in benefit or '쿠팡' in benefit or '티몬' in benefit or '위메프' in benefit,
        }

        found_keywords = [k for k, v in keywords.items() if v]
        if found_keywords:
            print(f"발견된 키워드: {', '.join(found_keywords)}")

        # 숫자 패턴 분석
        import re

        # X% 할인
        discount_rates = re.findall(r'(\d+(?:\.\d+)?)%\s*할인', benefit)
        if discount_rates:
            print(f"할인율: {', '.join(set(discount_rates))}%")

        # X원 할인
        discount_amounts = re.findall(r'(\d{1,3}(?:,\d{3})*)\s*원\s*할인', benefit)
        if discount_amounts:
            print(f"할인 금액: {', '.join(set(discount_amounts[:3]))}원")

        # 리터당 X원
        liter_discounts = re.findall(r'리터당\s*(\d+)\s*원', benefit)
        if liter_discounts:
            print(f"리터당 할인: {', '.join(set(liter_discounts))}원")

        # 월 X원 한도
        monthly_limits = re.findall(r'월\s*(?:최대\s*)?(\d{1,3}(?:,\d{3})*)\s*원', benefit)
        if monthly_limits:
            print(f"월 한도: {', '.join(set(monthly_limits[:3]))}원")

        # 전월 X만원 실적
        pre_month = re.findall(r'전월.*?(\d{1,3}(?:,\d{3})*)\s*만원', benefit)
        if pre_month:
            print(f"전월 실적 조건: {', '.join(set(pre_month[:3]))}만원")

        # X% 적립
        point_rates = re.findall(r'(\d+(?:\.\d+)?)%\s*(?:적립|캐시백|포인트)', benefit)
        if point_rates:
            print(f"적립율: {', '.join(set(point_rates))}%")

print(f"\n{'='*100}")
print("분석 완료")
print(f"{'='*100}")
