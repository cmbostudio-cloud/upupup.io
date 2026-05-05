# Firestore Ranking Rules

현재 무한 랭킹 컬렉션(`infiniteLeaderboard`)은 클라이언트에서 직접 읽기/쓰기합니다.

`allow read, write: if false;`로 전체 차단하면 랭킹 조회가 항상 실패합니다.
아래 규칙으로 교체하세요.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /infiniteLeaderboard/{uid} {
      // 랭킹은 누구나 읽기 가능
      allow read: if true;

      // 로그인한 본인 문서만 생성/갱신 가능
      allow create, update: if request.auth != null
                            && request.auth.uid == uid
                            && request.resource.data.uid == request.auth.uid
                            && request.resource.data.score is int
                            && request.resource.data.score >= 0
                            && request.resource.data.nickname is string
                            && request.resource.data.nickname.size() > 0
                            && request.resource.data.nickname.size() <= 20;

      // 삭제는 금지
      allow delete: if false;
    }
  }
}
```

또한 쿼리(`score desc`, `updatedAt asc`)를 사용하므로 Firestore Composite Index가 필요합니다.
앱 실행 후 콘솔 에러의 링크를 눌러 인덱스를 한 번 생성하면 이후 정상 동작합니다.
