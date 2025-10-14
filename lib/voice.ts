type RecordingCallbacks = {
  onLevel?: (level: number) => void;
};

export interface RecordingHandle {
  stop: (options?: { discard?: boolean }) => Promise<string | undefined>;
}

const SAMPLE_TRANSCRIPTS = [
  '오늘은 식사를 했는지 기억이 잘 안나요.',
  '산책을 다녀왔는데 너무 즐거웠어요.',
  '약 복용 시간을 자꾸 놓치게 돼서 걱정이에요.',
  '손주를 만나고 왔는데 기분이 정말 좋습니다.',
  '최근 잠을 잘 이루지 못해 피곤해요.',
];

function pickSample() {
  return SAMPLE_TRANSCRIPTS[Math.floor(Math.random() * SAMPLE_TRANSCRIPTS.length)];
}

export async function startMockRecording(callbacks?: RecordingCallbacks): Promise<RecordingHandle> {
  let running = true;
  let currentLevel = 0.3;

  const interval = setInterval(() => {
    if (!running) return;
    currentLevel = Math.random();
    callbacks?.onLevel?.(currentLevel);
  }, 120);

  return {
    stop: async (options) => {
      running = false;
      clearInterval(interval);
      callbacks?.onLevel?.(0);
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (options?.discard) return undefined;
      return pickSample();
    },
  };
}
