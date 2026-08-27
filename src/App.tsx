import { useRef } from 'react';
import { useSession } from './session/useSession';
import { IntroScreen } from './components/screens/IntroScreen';
import { DisplayCheckScreen } from './components/screens/DisplayCheckScreen';
import { PlateStage } from './components/screens/PlateStage';
import { ThresholdStage } from './components/screens/ThresholdStage';
import { LuminanceStage } from './components/screens/LuminanceStage';
import { ArrangementStage } from './components/screens/ArrangementStage';
import { StageIntro } from './components/screens/StageIntro';
import { ProgressBar } from './components/ProgressBar';
import { ResultsScreen } from './components/screens/ResultsScreen';
import { SharedReportScreen } from './components/screens/SharedReportScreen';
import { StageAnnouncer, useStageAnnouncement } from './components/StageAnnouncer';

export function App() {
  const session = useSession();
  const mainRef = useRef<HTMLElement>(null);

  useStageAnnouncement(session.phase, mainRef);

  return (
    <div className="app">
      <StageAnnouncer phase={session.phase} />
      <ProgressBar phase={session.phase} progress={session.progress} />
      {/* tabIndex -1 lets focus move here on a phase change without adding a
          tab stop; see StageAnnouncer for why that matters. */}
      <main ref={mainRef} tabIndex={-1} className="app__main">
        {renderPhase(session)}
      </main>
    </div>
  );
}

function renderPhase(session: ReturnType<typeof useSession>) {
  switch (session.phase) {
    case 'intro':
      return <IntroScreen onStart={() => session.advance('displayCheck')} />;

    case 'displayCheck':
      return (
        <DisplayCheckScreen
          onContinue={() => session.advance('plates')}
          onBack={() => session.advance('intro')}
        />
      );

    case 'plates':
      return session.platePlan ? (
        <PlateStage
          plan={session.platePlan}
          index={session.plateIndex}
          total={session.plateTotal}
          onAnswer={session.answerPlate}
        />
      ) : null;

    case 'thresholdsIntro':
      return (
        <StageIntro
          title="Stage 2 of 4 &mdash; colour sensitivity"
          onContinue={() => session.advance('thresholds')}
        >
          <p>
            A ring of dots appears with a gap in one side. Point the arrow key at the gap.
          </p>
          <p style={{ marginBottom: 0 }}>
            The colour difference shrinks until you get it wrong, then grows. So{' '}
            <strong>expect</strong> to be unsure &mdash; guess when you are, the maths accounts for
            it. Longest stage, about 2&frac12; minutes.
          </p>
        </StageIntro>
      );

    case 'thresholds':
      return session.thresholdTrial ? (
        <ThresholdStage
          trial={session.thresholdTrial}
          trialCount={session.thresholdTrialCount}
          estimatedRemaining={session.thresholdEstimatedRemaining}
          onAnswer={session.answerThreshold}
        />
      ) : null;

    case 'luminanceIntro':
      return (
        <StageIntro
          title="Stage 3 of 4 &mdash; brightness match"
          onContinue={() => session.advance('luminance')}
          adaptSeconds={2}
        >
          <p>
            Slide until the red square is as <strong>bright</strong> as the grey one.
          </p>
          <p style={{ marginBottom: 0 }}>
            They will never be the same <em>colour</em> &mdash; ignore that, judge brightness only.
            Four rounds from different starting points.
          </p>
        </StageIntro>
      );

    case 'luminance':
      return (
        <LuminanceStage
          repeat={session.luminanceRepeat}
          total={session.luminanceRepeatTotal}
          start={session.luminanceStart}
          onSubmit={session.submitLuminance}
        />
      );

    case 'arrangementIntro':
      return (
        <StageIntro
          title="Stage 4 of 4 &mdash; colour ordering"
          onContinue={() => session.advance('arrangement')}
          adaptSeconds={2}
        >
          <p>
            Order the swatches so the sequence changes as smoothly as possible. The leftmost one is
            fixed as your starting point.
          </p>
          <p style={{ marginBottom: 0 }}>
            Drag, or arrow keys and <kbd>Space</kbd>. About 90 seconds.
          </p>
        </StageIntro>
      );

    case 'arrangement':
      return (
        <ArrangementStage
          order={session.capOrder}
          onChange={session.setCapOrder}
          onSubmit={session.submitArrangement}
        />
      );

    case 'results':
      if (!session.results) return null;
      // A shared link is read by someone else, so it gets the explainer written
      // about the sharer rather than a copy of the sharer's own report.
      return session.isShared ? (
        <SharedReportScreen
          assessment={session.results.assessment}
          name={session.sharedName}
          onTakeTest={session.restart}
        />
      ) : (
        <ResultsScreen results={session.results} onRestart={session.restart} />
      );
  }
}
