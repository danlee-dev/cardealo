from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pathlib import Path
import os
from course_recommender import CourseRecommender

# Load environment variables from backend/.env (parent directory)
ai_dir = Path(__file__).parent
backend_dir = ai_dir.parent
env_path = backend_dir / '.env'
load_dotenv(dotenv_path=env_path)

app = Flask(__name__)
CORS(app)

recommender = CourseRecommender()

PORT = int(os.getenv('FLASK_PORT', 5002))


@app.route('/health', methods=['GET'])
def health_check():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'service': 'cardealo-ai-course-recommender'
    })


@app.route('/api/recommend-course', methods=['POST'])
def recommend_course():
    """
    AI 기반 코스 추천 API

    Request:
    {
        "user_input": "데이트 코스 추천해줘",
        "user_location": {
            "latitude": 37.5856,
            "longitude": 127.0292
        },
        "user_cards": ["신한카드", "국민카드"],
        "max_distance": 5000,  # optional, default 5000
        "num_options": 3       # optional, default 3
    }

    Response:
    {
        "intent": {
            "theme": "date",
            "categories": ["cafe", "restaurant", "movie"],
            "time_of_day": "evening",
            "transport_mode": "WALK",
            ...
        },
        "courses": [
            {
                "rank": 1,
                "places": [
                    {
                        "name": "스타벅스",
                        "category": "cafe",
                        "latitude": 37.xxx,
                        "longitude": 127.xxx,
                        "top_benefit": {
                            "card": "신한카드",
                            "score": 85,
                            "benefit": "10% 할인"
                        }
                    }
                ],
                "routes": [
                    {
                        "type": "WALK",
                        "distance": 500,
                        "duration": 7,
                        "polyline": [[37.xxx, 127.xxx], ...]
                    }
                ],
                "total_distance": 2000,
                "total_duration": 30,
                "total_benefit_score": 250,
                "summary": "스타벅스, 맛집, 영화관 코스를 추천합니다."
            }
        ]
    }
    """

    try:
        data = request.get_json()

        user_input = data.get('user_input')
        user_location = data.get('user_location')
        user_cards = data.get('user_cards', [])
        max_distance = data.get('max_distance', 5000)
        num_options = data.get('num_options', 3)

        if not user_input or not user_location:
            return jsonify({
                'error': 'user_input and user_location are required'
            }), 400

        result = recommender.recommend_courses(
            user_input=user_input,
            user_location=user_location,
            user_cards=user_cards,
            max_distance=max_distance,
            num_options=num_options
        )

        return jsonify(result)

    except Exception as e:
        print(f"[API Error] {e}")
        import traceback
        traceback.print_exc()

        return jsonify({
            'error': str(e)
        }), 500


if __name__ == '__main__':
    print(f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║  CARDEALO AI Course Recommender                              ║
    ║  http://localhost:{PORT}                                     ║
    ╚══════════════════════════════════════════════════════════════╝
    """)

    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=os.getenv('FLASK_ENV') == 'development'
    )
