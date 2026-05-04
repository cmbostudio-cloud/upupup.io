# 스테이지 에디터

이 폴더에는 JSON 기반 스테이지 레이아웃을 만드는 독립형 에디터가 들어 있습니다.

## 파일

- `index.html` - 진입 페이지
- `editor.js` - 오브젝트 편집, 드래그, 가져오기/내보내기, 로컬 초안 저장
- `editor.css` - 에디터 레이아웃과 스타일
- `data/stages/` - 내보낸 스테이지 JSON 파일
## JSON 형식

에디터는 다음과 같은 형식으로 내보냅니다.

```json
{
  "version": 1,
  "stage": 1,
  "name": "스테이지 1",
  "settings": {
    "mapWidth": 900,
    "groundY": 2040,
    "gridSize": 60
  },
  "objects": [
    { "id": "stick-1", "type": "stick", "x": 128, "y": 1750, "width": 644, "height": 18 },
    { "id": "star-1", "type": "star", "x": 286, "y": 1666, "width": 28, "height": 28 }
  ]
}
```

## 현재 범위

- `stick`은 게임의 `addStick(x, y, width, height)`에 대응합니다.
- `star`는 게임의 `addPortal(x, y, width, height)`에 대응합니다.
- 에디터에는 현재 1스테이지를 기준으로 한 샘플 레이아웃이 들어 있습니다.
