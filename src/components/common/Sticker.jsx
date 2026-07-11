export function Sticker({ src, alt, className = '' }) {
  return <img className={`sticker ${className}`} src={src} alt={alt} draggable="false" />;
}
