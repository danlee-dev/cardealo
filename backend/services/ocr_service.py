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

        # 카드사 이름 추출 (일반적인 카드사 이름 패턴)
        card_companies = [
            '신한', '삼성', '현대', '롯데', 'KB', '국민', '우리', 'NH', '농협',
            '하나', '기업', 'IBK', 'SC', '씨티', '카카오뱅크', '토스뱅크',
            'Shinhan', 'Samsung', 'Hyundai', 'Lotte', 'Woori', 'Hana', 'Kakao', 'Toss'
        ]

        for company in card_companies:
            if company in text:
                card_info['card_name'] = company
                break

        return card_info


def extract_card_info_from_image(image_base64: str, image_format: str = "jpg") -> Dict[str, Any]:
    """
    카드 이미지에서 정보 추출 (헬퍼 함수)
    """
    service = NaverOCRService()
    return service.extract_card_info(image_base64, image_format)
