import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(script_dir, '../benefits_db_v2.json')

with open(db_path, 'r', encoding='utf-8') as f:
    db = json.load(f)

# 홈플러스 혜택 확인
if 'mart' in db and '홈플러스' in db['mart']:
    print('='*80)
    print('홈플러스 혜택 (Top 5):')
    print('='*80)
    for i, benefit in enumerate(db['mart']['홈플러스'][:5], 1):
        print(f"\n{i}. {benefit['card']}")
        print(f"   점수: {benefit['score']}")
        print(f"   할인율: {benefit['discount_rate']}%")
        print(f"   할인금액: {benefit['discount_amount']:,}원")
        print(f"   월한도: {benefit['monthly_limit']:,}원")
        print(f"   전월실적: {benefit['pre_month_money']:,}원")
        print(f"   혜택 미리보기: {benefit['benefit_text'][:150]}...")

# 카페 카테고리 확인
if 'cafe' in db:
    print(f"\n\n{'='*80}")
    print(f"카페 카테고리 가맹점: {list(db['cafe'].keys())}")
    print('='*80)

    if '스타벅스' in db['cafe']:
        print(f"\n스타벅스 혜택 수: {len(db['cafe']['스타벅스'])}")
        print("\n스타벅스 Top 3:")
        for i, benefit in enumerate(db['cafe']['스타벅스'][:3], 1):
            print(f"\n{i}. {benefit['card']} (점수: {benefit['score']})")
            print(f"   할인율: {benefit['discount_rate']}%, 할인금액: {benefit['discount_amount']:,}원")
