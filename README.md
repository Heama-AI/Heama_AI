# 🧠 해마 (HAEMA): AI 기반 인지 건강 케어 챗봇

> 일상적인 대화로 나의 인지 건강을 관리하고, 소중한 기억을 지켜주는 AI 친구
<p align="center">
  <img width="200" alt="image" src="https://github.com/user-attachments/assets/a5510d7c-7c7c-4e14-9406-e239dd350beb" />
</p>

[![React Native](https://img.shields.io/badge/React%20Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![HL7 FHIR](https://img.shields.io/badge/HL7%20FHIR-F47C2A?style=for-the-badge)](https://www.hl7.org/fhir/)

---

## 🧐 프로젝트 소개 (About)

**해마(HAEMA)**는 초고령 사회의 가장 큰 건강 문제 중 하나인 '치매'를 가정 내에서 효과적으로 관리하고 조기에 발견할 수 있도록 돕는 AI 기반 모바일 헬스케어 서비스입니다. 기존의 파편화된 진단, 훈련, 교감 서비스를 하나로 통합하여, 사용자가 일상적인 대화를 나누는 것만으로도 자신의 인지 건강 상태를 지속적으로 모니터링하고 관리할 수 있는 통합 솔루션을 제공합니다.

단순한 챗봇을 넘어, 당신의 소중한 기억을 지켜주는 든든한 친구가 되어 드립니다.
<p align="center">
<img width="200" alt="image" src="https://github.com/user-attachments/assets/202128dd-f29e-462b-b1bc-5ad9c0fd8420" />
<img width="200" alt="image" src="https://github.com/user-attachments/assets/8650f8c5-7bde-4935-a5a1-83dbca611c1a" />
</p>
## ✨ 주요 기능 (Features)

### 📊 실시간 인지 건강 모니터링
- **음성/언어 지표 추출**: 대화 음성에서 **말속도, 휴지, 목소리 톤 변화, 평균 발화 길이** 등 6가지 핵심 디지털 바이오마커를 실시간으로 자동 분석합니다.
- **시계열 대시보드**: 추출된 지표의 변화 추이를 주간/월간 그래프로 시각화하여 사용자와 보호자가 직관적으로 건강 상태를 파악할 수 있도록 돕습니다.
<p align="center">
  <img width="200" alt="image" src="https://github.com/user-attachments/assets/e486248a-5431-48c3-87ce-3ec47cd51376" />
</p>
### 🛡️ 개인정보를 최우선으로 생각하는 기억 보조
- **온디바이스 AI**: 민감한 개인 정보(일정, 가족, 선호도 등)는 외부 서버로 전송하지 않고, **디바이스 내에서** 경량화된 AI 모델(Gemma-3-270m)과 HAEMA 메모리 아키텍처를 통해 안전하게 처리 및 저장됩니다.
- **기억 퀴즈**: 저장된 개인화된 기억을 바탕으로 "지난주에 방문했던 병원 이름은 무엇이었나요?" 와 같은 맞춤형 퀴즈를 제공하여 기억력 유지를 돕습니다.

### 🎮 K-MMSE 기반의 재미있는 인지 훈련
- **임상적 근거 기반 게임**: 실제 임상에서 사용하는 인지 기능 검사(K-MMSE)의 핵심 요소를 '그림 보고 설명하기', '시장 가서 물건 사기'(집행기능 훈련) 등 재미있는 게임 형태로 재구성했습니다.
- **동기부여 및 피드백**: 게임 결과를 기록하고 긍정적인 피드백과 함께 새로운 목표를 제시하여 꾸준한 참여를 유도합니다.
<p align="center">
  <img width="200" alt="image" src="https://github.com/user-attachments/assets/fef376a3-e49d-4f3c-9cb2-45a715be7fd7" />
  <img width="200" alt="image" src="https://github.com/user-attachments/assets/19b391e0-4bab-4585-ba51-65d94b82976e" />
</p>

### 👨‍👩‍👧‍👦 가족과 함께하는 협력적 돌봄
- **보호자 연동**: 사용자의 동의 하에 보호자 계정을 연동할 수 있습니다.
- **자동 리포트 전송**: 주간/월간 지표 요약, 위험도 변화, 활동 내역 등을 담은 리포트를 보호자에게 이메일로 자동 전송하여 가족이 함께 환자의 상태를 이해하고 돌봄에 참여하도록 돕습니다.

## 🛠️ 기술 스택 (Tech Stack)

| 분야 | 기술 |
| :--- | :--- |
| **Frontend** | `React Native`, `TypeScript` |
| **Backend** | `FastAPI`, `Python` |
| **Database**| `PostgreSQL` (FHIR 표준 데이터), `MongoDB` (대화 로그) |
| **AI Models** | `gpt-4o-mini`(상담), `Gemma-3-270m`(온디바이스), `XGBoost`/`LSTM`(위험도 예측) |
| **Standards**| `HL7 FHIR` (의료 데이터 표준) |
| **Infra** | `Docker`, `AWS/GCP` (예정) |
