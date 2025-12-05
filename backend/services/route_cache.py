"""
경로 캐시 서비스
API 비용 절감을 위해 경로 정보를 DB에 캐싱
"""
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy import select

from .database import get_db, RouteCache


class RouteCacheService:
    """경로 정보 캐시 서비스"""

    # 좌표 정밀도 (소수점 4자리 = 약 11m 정확도)
    COORD_PRECISION = 4

    # 캐시 만료 시간 (일)
    CACHE_EXPIRY_DAYS = 30

    @classmethod
    def _generate_cache_key(
        cls,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        mode: str
    ) -> str:
        """캐시 키 생성 (좌표 반올림 적용)"""
        o_lat = round(origin_lat, cls.COORD_PRECISION)
        o_lng = round(origin_lng, cls.COORD_PRECISION)
        d_lat = round(dest_lat, cls.COORD_PRECISION)
        d_lng = round(dest_lng, cls.COORD_PRECISION)

        return f"{o_lat}_{o_lng}_{d_lat}_{d_lng}_{mode}"

    @classmethod
    def get_cached_route(
        cls,
        origin: Dict[str, float],
        destination: Dict[str, float],
        mode: str
    ) -> Optional[Dict[str, Any]]:
        """
        캐시된 경로 정보 조회

        Args:
            origin: {"latitude": float, "longitude": float}
            destination: {"latitude": float, "longitude": float}
            mode: "walking", "driving", "transit"

        Returns:
            캐시된 경로 데이터 또는 None
        """
        cache_key = cls._generate_cache_key(
            origin['latitude'], origin['longitude'],
            destination['latitude'], destination['longitude'],
            mode
        )

        db = get_db()
        try:
            cache_entry = db.scalars(
                select(RouteCache).where(RouteCache.cache_key == cache_key)
            ).first()

            if not cache_entry:
                return None

            # 만료 확인
            expiry_date = cache_entry.created_at + timedelta(days=cls.CACHE_EXPIRY_DAYS)
            if datetime.utcnow() > expiry_date:
                # 만료된 캐시 삭제
                db.delete(cache_entry)
                db.commit()
                print(f"[RouteCache] Expired cache removed: {cache_key}")
                return None

            # 캐시 적중 횟수 업데이트
            cache_entry.hit_count += 1
            cache_entry.last_hit_at = datetime.utcnow()
            db.commit()

            print(f"[RouteCache] Cache HIT: {cache_key} (hits: {cache_entry.hit_count})")
            return json.loads(cache_entry.response_data)

        except Exception as e:
            print(f"[RouteCache] Error reading cache: {e}")
            return None
        finally:
            db.close()

    @classmethod
    def save_route_to_cache(
        cls,
        origin: Dict[str, float],
        destination: Dict[str, float],
        mode: str,
        response_data: Dict[str, Any]
    ) -> bool:
        """
        경로 정보를 캐시에 저장

        Args:
            origin: {"latitude": float, "longitude": float}
            destination: {"latitude": float, "longitude": float}
            mode: "walking", "driving", "transit"
            response_data: API 응답 데이터

        Returns:
            저장 성공 여부
        """
        cache_key = cls._generate_cache_key(
            origin['latitude'], origin['longitude'],
            destination['latitude'], destination['longitude'],
            mode
        )

        db = get_db()
        try:
            # 이미 존재하는지 확인
            existing = db.scalars(
                select(RouteCache).where(RouteCache.cache_key == cache_key)
            ).first()

            if existing:
                # 기존 캐시 업데이트
                existing.response_data = json.dumps(response_data, ensure_ascii=False)
                existing.created_at = datetime.utcnow()
                existing.hit_count = 0
                print(f"[RouteCache] Cache UPDATED: {cache_key}")
            else:
                # 새 캐시 생성
                o_lat = round(origin['latitude'], cls.COORD_PRECISION)
                o_lng = round(origin['longitude'], cls.COORD_PRECISION)
                d_lat = round(destination['latitude'], cls.COORD_PRECISION)
                d_lng = round(destination['longitude'], cls.COORD_PRECISION)

                new_cache = RouteCache(
                    cache_key=cache_key,
                    origin_lat=str(o_lat),
                    origin_lng=str(o_lng),
                    dest_lat=str(d_lat),
                    dest_lng=str(d_lng),
                    mode=mode,
                    response_data=json.dumps(response_data, ensure_ascii=False)
                )
                db.add(new_cache)
                print(f"[RouteCache] Cache SAVED: {cache_key}")

            db.commit()
            return True

        except Exception as e:
            db.rollback()
            print(f"[RouteCache] Error saving cache: {e}")
            return False
        finally:
            db.close()

    @classmethod
    def get_cache_stats(cls) -> Dict[str, Any]:
        """캐시 통계 조회"""
        db = get_db()
        try:
            from sqlalchemy import func

            total_entries = db.query(func.count(RouteCache.id)).scalar() or 0
            total_hits = db.query(func.sum(RouteCache.hit_count)).scalar() or 0

            # 모드별 통계
            mode_stats = {}
            for mode in ['walking', 'driving', 'transit']:
                count = db.query(func.count(RouteCache.id)).filter(
                    RouteCache.mode == mode
                ).scalar() or 0
                mode_stats[mode] = count

            return {
                'total_entries': total_entries,
                'total_hits': total_hits,
                'by_mode': mode_stats
            }

        except Exception as e:
            print(f"[RouteCache] Error getting stats: {e}")
            return {'error': str(e)}
        finally:
            db.close()

    @classmethod
    def clear_expired_cache(cls) -> int:
        """만료된 캐시 정리"""
        db = get_db()
        try:
            expiry_date = datetime.utcnow() - timedelta(days=cls.CACHE_EXPIRY_DAYS)

            expired = db.query(RouteCache).filter(
                RouteCache.created_at < expiry_date
            ).all()

            deleted_count = len(expired)
            for entry in expired:
                db.delete(entry)

            db.commit()
            print(f"[RouteCache] Cleared {deleted_count} expired entries")
            return deleted_count

        except Exception as e:
            db.rollback()
            print(f"[RouteCache] Error clearing cache: {e}")
            return 0
        finally:
            db.close()


# 싱글톤 인스턴스
route_cache = RouteCacheService()
