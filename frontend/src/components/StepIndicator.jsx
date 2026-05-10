/**
 * LinguBridge AI — StepIndicator
 * HCI: Visibility of system status — kullanıcı şu an hangi aşamada olduğunu görür.
 *
 * Adımlar:
 *   1. Konuş veya yaz   (sourceText var mı?)
 *   2. Tonu/nezaketi ayarla
 *   3. Çevir & adapte et (adaptedText var mı?)
 *   4. Öner / dinle / gönder (suggestions var mı?)
 */

const STEPS = [
  { id: 1, icon: '🎤', label: 'Konuş veya yaz' },
  { id: 2, icon: '🎚️', label: 'Tonu ayarla' },
  { id: 3, icon: '🌍', label: 'Çevir & adapte et' },
  { id: 4, icon: '💬', label: 'Dinle veya öneri seç' },
];

export default function StepIndicator({ activeStep = 1, completed = [] }) {
  return (
    <ol className="step-indicator" aria-label="İletişim akışı">
      {STEPS.map((step, idx) => {
        const isDone = completed.includes(step.id);
        const isActive = activeStep === step.id;
        const cls = `step-item${isActive ? ' active' : ''}${isDone ? ' done' : ''}`;
        return (
          <li
            key={step.id}
            className={cls}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="step-circle" aria-hidden="true">
              {isDone ? '✓' : step.icon}
            </span>
            <span className="step-label">
              <span className="step-num">{step.id}.</span> {step.label}
            </span>
            {idx < STEPS.length - 1 && <span className="step-connector" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
