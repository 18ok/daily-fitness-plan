import { Sticker } from './Sticker';

export function ResultCard({ tone, icon: Icon, title, subtitle, detail, chips, sticker, alt }) {
  return (
    <article className={`result-card ${tone}`}>
      <div className="result-icon">
        <Icon size={19} strokeWidth={2.4} />
      </div>
      <div className="result-copy">
        <div className="result-title-row">
          <h3>{title}</h3>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <p>{detail}</p>
        {chips?.length > 0 && (
          <div className="mini-tags">
            {chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        )}
      </div>
      {sticker && (
        <span className="card-sticker-frame">
          <Sticker src={sticker} alt={alt} className="card-sticker" />
        </span>
      )}
    </article>
  );
}
