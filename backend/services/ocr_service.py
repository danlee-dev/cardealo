import os
import requests
import uuid
import time
import base64
import re
from typing import Dict, Any, Optional


class NaverOCRService:
    def __init__(self):
        self.secret_key = os.getenv('NAVER_OCR_SECRET_KEY')
        self.invoke_url = os.getenv('NAVER_OCR_INVOKE_URL')

        if not self.secret_key or not self.invoke_url:
            raise ValueError("NAVER_OCR_SECRET_KEY and NAVER_OCR_INVOKE_URL must be set in environment variables")

    def extract_card_info(self, image_base64: str, image_format: str = "jpg") -> Dict[str, Any]:
        """
        카드 이미지에서 OCR을 통해 정보 추출

        Args:
            image_base64: Base64로 인코딩된 이미지 데이터
            image_format: 이미지 포맷 (jpg, png, pdf, tiff)

        Returns:
            카드 정보 딕셔너리 (card_number, card_name, expiry_date, raw_text)
        """
        try:
            # OCR API 호출
            ocr_result = self._call_ocr_api(image_base64, image_format)

            # OCR 결과에서 텍스트 추출
            raw_text = self._extract_text_from_ocr(ocr_result)

            # 카드 정보 파싱
            card_info = self._parse_card_info(raw_text)
            card_info['raw_text'] = raw_text
            card_info['success'] = True

            print(f"[OCR Success] Card extracted: {card_info.get('card_name', 'Unknown')}")
            return card_info

        except Exception as e:
            print(f"[OCR Error] {e}")
            return {
                'success': False,
                'error': str(e),
                'card_number': None,
                'card_name': None,
                'expiry_date': None,
                'raw_text': None
            }

    def _call_ocr_api(self, image_base64: str, image_format: str) -> Dict[str, Any]:
        """
        네이버 클라우드 OCR API 호출
        """
        # API 요청 데이터 구성
        request_id = str(uuid.uuid4())
        timestamp = int(time.time() * 1000)  # 밀리초 단위

        request_data = {
            "version": "V2",
            "requestId": request_id,
            "timestamp": timestamp,
            "images": [
                {
                    "format": image_format,
                    "name": "card_image",
                    "data": image_base64
                }
            ]
        }

        # API 호출
        headers = {
            "X-OCR-SECRET": self.secret_key,
            "Content-Type": "application/json"
        }

        response = requests.post(
            self.invoke_url,
            headers=headers,
            json=request_data,
            timeout=30
        )

        if response.status_code != 200:
            raise Exception(f"OCR API Error: {response.status_code} - {response.text}")

        return response.json()

    def _extract_text_from_ocr(self, ocr_result: Dict[str, Any]) -> str:
        """
        OCR 결과에서 텍스트 추출
        """
        all_text = []

        if 'images' in ocr_result:
            for image in ocr_result['images']:
                if 'fields' in image:
                    for field in image['fields']:
                        if 'inferText' in field:
                            all_text.append(field['inferText'])

        return ' '.join(all_text)

    def _parse_card_info(self, text: str) -> Dict[str, Optional[str]]:
        """
        OCR 텍스트에서 카드 정보 파싱
        """
        card_info = {
            'card_number': None,
            'card_name': None,
            'expiry_date': None
        }

        # 카드 번호 추출 (16자리 숫자, 띄어쓰기 또는 하이픈 포함 가능)
        # 예: 1234 5678 9012 3456, 1234-5678-9012-3456
        card_number_pattern = r'\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b'
        card_number_match = re.search(card_number_pattern, text)
        if card_number_match:
            # 공백과 하이픈 제거
            card_info['card_number'] = re.sub(r'[\s-]', '', card_number_match.group(1))

        # 유효기간 추출 (MM/YY 또는 MM/YYYY 형식)
        # 예: 12/25, 12/2025
        expiry_pattern = r'\b(\d{2})[/\s](\d{2,4})\b'
        expiry_match = re.search(expiry_pattern, text)
        if expiry_match:
            month = expiry_match.group(1)
            year = expiry_match.group(2)
            # 2자리 연도는 20XX로 변환
            if len(year) == 2:
                year = '20' + year
            card_info['expiry_date'] = f"{month}/{year[-2:]}"  # MM/YY 형식으로 저장

        # 카드사 이름 추출 (한글/영문 매칭)
        # 한글 -> 영문 매핑 포함
        card_company_mapping = {
            # 한글 카드사
            '신한': '신한',
            '삼성': '삼성',
            '현대': '현대',
            '롯데': '롯데',
            'KB': 'KB',
            '국민': '국민',
            '우리': '우리',
            'NH': 'NH',
            '농협': '농협',
            '하나': '하나',
            '기업': '기업',
            'IBK': 'IBK',
            'SC': 'SC',
            '씨티': '씨티',
            '카카오뱅크': '카카오뱅크',
            '토스뱅크': '토스뱅크',
            # 영문 카드사 (대소문자 구분 없이 매칭)
            'SHINHAN': '신한',
            'Shinhan': '신한',
            'shinhan': '신한',
            'SAMSUNG': '삼성',
            'Samsung': '삼성',
            'samsung': '삼성',
            'HYUNDAI': '현대',
            'Hyundai': '현대',
            'hyundai': '현대',
            'LOTTE': '롯데',
            'Lotte': '롯데',
            'lotte': '롯데',
            'KOOKMIN': '국민',
            'Kookmin': '국민',
            'kookmin': '국민',
            'WOORI': '우리',
            'Woori': '우리',
            'woori': '우리',
            'HANA': '하나',
            'Hana': '하나',
            'hana': '하나',
            'KAKAO': '카카오뱅크',
            'Kakao': '카카오뱅크',
            'kakao': '카카오뱅크',
            'TOSS': '토스뱅크',
            'Toss': '토스뱅크',
            'toss': '토스뱅크',
            'CITI': '씨티',
            'Citi': '씨티',
            'citi': '씨티',
            'CITIBANK': '씨티',
            'Citibank': '씨티',
            'citibank': '씨티',
        }

        for company_text, company_name in card_company_mapping.items():
            if company_text in text:
                card_info['card_name'] = company_name
                break

        return card_info

    def extract_receipt_info(self, image_base64: str, image_format: str = "jpg") -> Dict[str, Any]:
        """
        영수증 이미지에서 OCR을 통해 정보 추출

        Args:
            image_base64: Base64로 인코딩된 이미지 데이터
            image_format: 이미지 포맷 (jpg, png, pdf, tiff)

        Returns:
            영수증 정보 딕셔너리
        """
        try:
            # OCR API 호출
            ocr_result = self._call_ocr_api(image_base64, image_format)

            # OCR 결과에서 텍스트 추출
            raw_text = self._extract_text_from_ocr(ocr_result)

            # 영수증 정보 파싱
            receipt_info = self._parse_receipt_info(raw_text)
            receipt_info['raw_text'] = raw_text
            receipt_info['success'] = True

            print(f"[OCR Success] Receipt extracted: {receipt_info.get('merchant_name', 'Unknown')}")
            return receipt_info

        except Exception as e:
            print(f"[OCR Error] {e}")
            return {
                'success': False,
                'error': str(e),
                'merchant_name': None,
                'total_amount': None,
                'payment_date': None,
                'items': [],
                'raw_text': None
            }

    def _parse_receipt_info(self, text: str) -> Dict[str, Any]:
        """
        OCR 텍스트에서 영수증 정보 파싱
        """
        receipt_info = {
            'merchant_name': None,
            'merchant_category': None,
            'total_amount': None,
            'payment_date': None,
            'payment_time': None,
            'card_number': None,
            'approval_number': None,
            'items': []
        }

        lines = text.split()

        # 가맹점명 추출 (보통 첫 줄이나 상호명 다음에 위치)
        merchant_keywords = ['상호', '가맹점', '매장', '점포']
        for i, line in enumerate(lines):
            for keyword in merchant_keywords:
                if keyword in line:
                    # 키워드 다음 단어를 가맹점명으로
                    if i + 1 < len(lines):
                        receipt_info['merchant_name'] = lines[i + 1]
                        break

        # 첫 몇 단어에서 가맹점명 추론 (키워드 없는 경우)
        if not receipt_info['merchant_name'] and len(lines) > 0:
            # 흔한 가맹점 패턴
            known_merchants = [
                '스타벅스', 'STARBUCKS', '투썸', 'TWOSOME', '이디야', 'EDIYA',
                'CU', 'GS25', '세븐일레븐', '7-ELEVEN', '미니스톱',
                '맥도날드', 'McDonald', '버거킹', 'BURGERKING', 'KFC',
                '이마트', 'EMART', '홈플러스', 'HOMEPLUS', '롯데마트',
                '배달의민족', '쿠팡이츠', '요기요', '배민',
                'SK주유소', 'GS칼텍스', 'S-OIL', '현대오일뱅크'
            ]
            for word in lines[:5]:
                for merchant in known_merchants:
                    if merchant.lower() in word.lower():
                        receipt_info['merchant_name'] = merchant
                        break
                if receipt_info['merchant_name']:
                    break

        # 가맹점 카테고리 추론
        category_mapping = {
            '스타벅스': '카페', 'STARBUCKS': '카페', '투썸': '카페', '이디야': '카페',
            'CU': '편의점', 'GS25': '편의점', '세븐일레븐': '편의점',
            '맥도날드': '패스트푸드', '버거킹': '패스트푸드', 'KFC': '패스트푸드',
            '이마트': '대형마트', '홈플러스': '대형마트', '롯데마트': '대형마트',
            '주유소': '주유', 'SK주유소': '주유', 'GS칼텍스': '주유', 'S-OIL': '주유',
            '배달의민족': '배달', '쿠팡이츠': '배달', '요기요': '배달'
        }
        if receipt_info['merchant_name']:
            for keyword, category in category_mapping.items():
                if keyword in receipt_info['merchant_name']:
                    receipt_info['merchant_category'] = category
                    break

        # 금액 추출 (숫자 + 원)
        amount_pattern = r'(\d{1,3}(?:,\d{3})*)\s*원'
        amount_matches = re.findall(amount_pattern, text)
        if amount_matches:
            # 가장 큰 금액을 총액으로 가정
            amounts = [int(a.replace(',', '')) for a in amount_matches]
            receipt_info['total_amount'] = max(amounts)

        # 결제 금액 키워드 근처의 금액 우선
        total_keywords = ['합계', '총액', '결제금액', '총금액', 'TOTAL', '청구금액']
        for i, word in enumerate(lines):
            for keyword in total_keywords:
                if keyword in word:
                    # 근처에서 금액 찾기
                    for j in range(max(0, i-2), min(len(lines), i+3)):
                        match = re.search(r'(\d{1,3}(?:,\d{3})*)', lines[j])
                        if match:
                            receipt_info['total_amount'] = int(match.group(1).replace(',', ''))
                            break

        # 날짜 추출 (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD 형식)
        date_pattern = r'(\d{4})[.\-/](\d{2})[.\-/](\d{2})'
        date_match = re.search(date_pattern, text)
        if date_match:
            receipt_info['payment_date'] = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"

        # 시간 추출 (HH:MM 또는 HH:MM:SS 형식)
        time_pattern = r'(\d{2}):(\d{2})(?::(\d{2}))?'
        time_match = re.search(time_pattern, text)
        if time_match:
            receipt_info['payment_time'] = f"{time_match.group(1)}:{time_match.group(2)}"

        # 카드번호 추출 (마스킹된 형식)
        card_pattern = r'(\d{4}[\s\-*]+\d{4}[\s\-*]+\d{4}[\s\-*]+\d{4}|\d{4}[\s\-*]+\*+[\s\-*]+\*+[\s\-*]+\d{4})'
        card_match = re.search(card_pattern, text)
        if card_match:
            receipt_info['card_number'] = card_match.group(1)

        # 승인번호 추출
        approval_pattern = r'승인\s*(?:번호|No)?[:\s]*(\d{6,10})'
        approval_match = re.search(approval_pattern, text)
        if approval_match:
            receipt_info['approval_number'] = approval_match.group(1)

        return receipt_info


def extract_card_info_from_image(image_base64: str, image_format: str = "jpg") -> Dict[str, Any]:
    """
    카드 이미지에서 정보 추출 (헬퍼 함수)
    """
    service = NaverOCRService()
    return service.extract_card_info(image_base64, image_format)
