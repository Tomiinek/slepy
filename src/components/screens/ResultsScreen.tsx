import type { SessionResults } from '../../session/types';
import { Headline } from '../results/Headline';
import { ConePanel } from '../results/ConePanel';
import { NumbersPanel } from '../results/NumbersPanel';
import { ConfusionFamilies } from '../results/ConfusionFamilies';
import { Simulator } from '../results/Simulator';
import { ChromaticityDiagram } from '../results/ChromaticityDiagram';
import { Implications } from '../results/Implications';
import { ExportPanel } from '../results/ExportPanel';

interface Props {
  readonly results: SessionResults;
  readonly onRestart: () => void;
}

export function ResultsScreen({ results, onRestart }: Props) {
  return (
    <div className="shell stack stack--loose">
      <Headline assessment={results.assessment} />
      <hr />
      <ConePanel assessment={results.assessment} />
      <hr />
      <NumbersPanel results={results} />
      <hr />
      <ConfusionFamilies vision={results.assessment.vision} />
      <hr />
      <Simulator assessment={results.assessment} />
      <hr />
      <ChromaticityDiagram assessment={results.assessment} />
      <hr />
      <Implications assessment={results.assessment} />
      <hr />
      <ExportPanel results={results} />
      <div className="row">
        <button type="button" className="btn btn--ghost" onClick={onRestart}>
          Take the test again
        </button>
      </div>
    </div>
  );
}
