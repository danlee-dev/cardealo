import requests
import collections
collections.Callable = collections.abc.Callable
from bs4 import BeautifulSoup
import json
import time


headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6,zh;q=0.5",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
}

url = 'https://api.card-gorilla.com:8080/v1/cards'

cards = {}
for i in range(1, 6000):

    response = requests.get(f'{url}/{i}', headers=headers)

    if response.status_code != 200:
        continue

    res = response.json()

    if res.get('is_discon'):
        continue

    data = {}
    data['brand'] = []
    data['key_benefit'] = []
    data['name'] = res.get('name')
    data['pre_month_money'] = res.get('pre_month_money')

    for b in res.get('brand'):
        data['brand'].append(b.get('name'))

    for k in res.get('key_benefit'):
        text = BeautifulSoup(k.get('info'), "html.parser").get_text()
        data['key_benefit'].append(text)
    cards[data['name']] = data
    time.sleep(0.1)

with open('cards.json', 'w') as f:
    json.dump(cards, f, ensure_ascii=False, indent=4)