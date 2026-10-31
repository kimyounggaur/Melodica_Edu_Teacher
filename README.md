# 멜로디카 클래스

교사가 음표·건반·오른손·호흡을 보여주고 학생이 실제 멜로디카로 따라 하는 한국어 16:9 수업 앱.

1.1에서는 멜로디카 본체와 건반 재질, 오른손·손가락 관절을 리마스터했다. 악기 패널의 `손모양 전체`는 손목까지, `건반 확대`는 건반과 손끝을 크게 보여 준다. 손 번호·계이름은 상단 버튼에서 켜고 끌 수 있다.

## 실행

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

빌드 결과는 dist, 오프라인 manifest는 빌드가 완료된 뒤 생성된다. 오프라인은 HTTPS의 정적 빌드에서 준비한다. 개발 서버의 원본 모듈 응답을 정식 오프라인 묶음으로 사용하지 않는다.

## 코드

- domain.ts: 음·손자리·tick·재시작과 수업 검증
- audio.ts: Web Audio와 무음 transport, 예약·취소·붙임줄
- Stage.tsx: 건반·분리 손 리그·악보
- content.ts: 단원·차시·곡·리듬·퀴즈
- storage.ts: 버전 있는 로컬 저장·JSON 입출력
- offline.ts / public/sw.js: 전체 자산 검증과 오프라인 캐시

교사 안내와 검증 범위는 docs에 있다. 실제 음색 청취·악기 실기·교실 40분 검수는 별도 확인 대상이다.
