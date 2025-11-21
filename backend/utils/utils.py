import re

def parse_place_name(place_str):
    """
    장소 문자열을 파싱합니다.
    - '카페 (스타벅스, 블루보틀 등)' 형식 (괄호 안에 '등' 포함) → '카페' 반환
    - '음식점 (한식, 중식, 일식)' 형식 (괄호 안에 '등' 없음) → '한식, 중식, 일식' 반환
    - '(a, b, c)' 형식 → 'a, b, c' 반환
    - 괄호가 없으면 원본 반환
    """
    if not place_str:
        return place_str
    
    place_str = place_str.strip()
    
    # 패턴 1: test(a, b, 등) 형식 - 괄호 안에 "등"이 있으면 괄호 앞의 문자열만 추출
    match = re.match(r'^([^\(]+)\((.+)\)$', place_str)
    if match:
        before_paren = match.group(1).strip()
        inside_paren = match.group(2).strip()
        
        # 괄호 안에 "등"이 있으면 괄호 앞의 카테고리명 반환
        if '등'==inside_paren[-1]:
            return before_paren
        # 괄호 안에 "등"이 없으면 괄호 안의 내용 반환
        else:
            return inside_paren
    
    # 패턴 2: (a, b, c) 형식 - 괄호 안의 문자열만 추출
    match = re.match(r'^\((.+)\)$', place_str)
    if match:
        return match.group(1).strip()
    
    # 괄호가 없으면 원본 반환
    return place_str