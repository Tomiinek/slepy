/**
 * Stage 3: put the colour caps into a smooth order.
 *
 * Drag and drop is the natural interaction, and it is also the one that excludes
 * people. So the keyboard path is a first-class equal here rather than a
 * fallback: arrow keys move the selection, space picks a cap up and puts it down,
 * and while carrying a cap the arrow keys move the cap itself. That happens to be
 * easier than dragging for many people, so it is offered on screen rather than
 * hidden in a help note.
 *
 * The first cap is fixed as the starting anchor, matching the printed test.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ANCHOR_INDEX, CAPS } from '../../stimuli/caps';

interface Props {
  readonly order: readonly number[];
  readonly onChange: (order: readonly number[]) => void;
  readonly onSubmit: () => void;
}

export function ArrangementStage({ order, onChange, onSubmit }: Props) {
  const [selected, setSelected] = useState(1);
  const [carrying, setCarrying] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const move = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 1 || to < 1 || from >= order.length || to >= order.length) return;
      const next = order.slice();
      const [cap] = next.splice(from, 1);
      next.splice(to, 0, cap);
      onChange(next);
    },
    [onChange, order],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const last = order.length - 1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const target = Math.min(last, Math.max(1, selected + delta));
        if (carrying) move(selected, target);
        setSelected(target);
        e.preventDefault();
      } else if (e.key === ' ' || e.key === 'Enter') {
        setCarrying((c) => !c);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setCarrying(false);
        e.preventDefault();
      } else if (e.key === 'Home') {
        const target = 1;
        if (carrying) move(selected, target);
        setSelected(target);
        e.preventDefault();
      } else if (e.key === 'End') {
        if (carrying) move(selected, last);
        setSelected(last);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [carrying, move, order.length, selected]);

  return (
    <div className="adaptation-field">
      <p className="stimulus-help">
        Arrange these into the smoothest possible colour sequence, so each swatch is as close as
        possible in colour to its neighbours. The leftmost one is fixed as your starting point.
      </p>

      <div
        ref={containerRef}
        className="caps"
        role="listbox"
        aria-label="Colour caps in your chosen order"
        aria-orientation="horizontal"
        tabIndex={0}
      >
        {order.map((capIndex, position) => {
          const cap = CAPS[capIndex];
          const anchored = position === 0 && capIndex === ANCHOR_INDEX;
          const isSelected = position === selected;

          return (
            <div
              key={capIndex}
              role="option"
              aria-selected={isSelected}
              aria-label={`Position ${position + 1} of ${order.length}${anchored ? ', fixed starting swatch' : ''}`}
              className={[
                'cap',
                anchored ? 'cap--anchor' : '',
                isSelected ? 'cap--selected' : '',
                isSelected && carrying ? 'cap--carrying' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ background: cap.hex }}
              draggable={!anchored}
              onClick={() => !anchored && setSelected(position)}
              onDragStart={() => {
                dragFrom.current = position;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom.current !== null) move(dragFrom.current, position);
                dragFrom.current = null;
              }}
            >
              {anchored && <span className="cap__pin" aria-hidden="true" />}
            </div>
          );
        })}
      </div>

      <div className="field-controls">
        <button
          type="button"
          className="field-btn"
          onClick={() => {
            const target = Math.max(1, selected - 1);
            move(selected, target);
            setSelected(target);
          }}
          disabled={selected <= 1}
          aria-label="Move selected swatch left"
        >
          &larr; Move left
        </button>
        <button
          type="button"
          className="field-btn"
          onClick={() => {
            const target = Math.min(order.length - 1, selected + 1);
            move(selected, target);
            setSelected(target);
          }}
          disabled={selected >= order.length - 1}
          aria-label="Move selected swatch right"
        >
          Move right &rarr;
        </button>
        <button type="button" className="field-btn field-btn--wide" onClick={onSubmit}>
          Done, see my results
        </button>
      </div>

      <p className="stimulus-help">
        Drag the swatches, or use the buttons, or press <kbd>&larr;</kbd> <kbd>&rarr;</kbd> to
        select and <kbd>Space</kbd> to pick up and drop.
        {carrying && <strong> Carrying a swatch &mdash; arrow keys will move it.</strong>}
      </p>
    </div>
  );
}
