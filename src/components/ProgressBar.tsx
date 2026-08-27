import { STAGE_LABEL, STAGE_ORDER, type Phase } from '../session/types';

interface Props {
  readonly phase: Phase;
  readonly progress: number;
}

/** Which stage a phase belongs to, including its lead-in screen. */
function stageOf(phase: Phase): Phase | null {
  switch (phase) {
    case 'plates':
      return 'plates';
    case 'thresholdsIntro':
    case 'thresholds':
      return 'thresholds';
    case 'luminanceIntro':
    case 'luminance':
      return 'luminance';
    case 'arrangementIntro':
    case 'arrangement':
      return 'arrangement';
    default:
      return null;
  }
}

export function ProgressBar({ phase, progress }: Props) {
  const stage = stageOf(phase);
  if (!stage) return null;

  const stageNumber = STAGE_ORDER.indexOf(stage) + 1;

  return (
    <div className="progress-bar">
      <div className="progress">
        <span className="mono" style={{ minWidth: '11ch' }}>
          Stage {stageNumber} of {STAGE_ORDER.length}
        </span>
        <div
          className="progress__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Overall test progress"
        >
          <div className="progress__fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span style={{ minWidth: '15ch', textAlign: 'right' }}>{STAGE_LABEL[stage]}</span>
      </div>
    </div>
  );
}
