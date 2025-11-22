# RAG 개요

이 앱에서 RAG(Relevant / Retrieval-Augmented Generation)는 기록한 대화를 잘게 쪼개어 임베딩한 뒤, 이후 기능에 재사용하는 파이프라인입니다.

## 파이프라인
- `store/recordsStore.ts`
  - 새 대화 저장 시 `chunkMessages`로 메시지를 450자 단위(80자 오버랩)로 분할.
  - 각 청크를 `embedText`로 임베딩 후 `lib/storage/recordChunksStorage`에 저장.
- `lib/rag/embed.ts`
  - 임베딩 공급자 선택: OpenAI / 로컬 서버(Ollama 등) / ExecuTorch 온디바이스.
  - 호출 실패 시 `null`을 반환해 인덱싱을 건너뜀(폴백 없음).
- `lib/storage/recordChunksStorage.ts`
  - SQLite에 청크+임베딩을 저장/로드.

## 활용처
- 기억력 퀴즈 (`app/games/memory-quiz.tsx`)
  - 최근 기록에서 청크를 뽑아 paraphrase/요약해 정답/오답 선택지를 만듦.
  - chunk 기반 RAG 문제 한 문항(`다음 중 대화에서 실제로 언급된 내용은…`)을 생성.
- 리콜 질문 (`lib/rag/recall.ts`)
  - 저장된 청크 중 하나를 스니펫으로 가져와 “이 내용 기억나나요?” 형태의 질문 생성.

## 환경 변수
- `EXPO_PUBLIC_EMBEDDING_PROVIDER`: `openai` | `local` | `executorch`
- OpenAI: `EXPO_PUBLIC_OPENAI_API_KEY`, `EXPO_PUBLIC_OPENAI_EMBEDDING_ENDPOINT`, `EXPO_PUBLIC_OPENAI_EMBEDDING_MODEL`
- 로컬: `EXPO_PUBLIC_LOCAL_EMBEDDING_ENDPOINT`, `EXPO_PUBLIC_LOCAL_EMBEDDING_MODEL`, `EXPO_PUBLIC_LOCAL_EMBEDDING_API_KEY?`
- ExecuTorch: `EXPO_PUBLIC_EXECUTORCH_EMBED_MODEL_SOURCE`, `EXPO_PUBLIC_EXECUTORCH_EMBED_TOKENIZER_SOURCE`
