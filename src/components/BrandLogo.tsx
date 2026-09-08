type BrandLogoProps = {
  height?: number;
  className?: string;
  collapsed?: boolean;
};

const SRC = "/LOGO-new.png";

export function BrandLogo({ height = 36, className = "", collapsed = false }: BrandLogoProps) {
  if (collapsed) {
    return (
      <img
        src={SRC}
        alt="Optech"
        className={`h-8 w-8 object-contain ${className}`}
        width={32}
        height={32}
      />
    );
  }

  const width = Math.round(height * 2.6);
  return (
    <img
      src={SRC}
      alt="Optech Computer Institute"
      className={`object-contain ${className}`}
      style={{ height, width: "auto", maxWidth: width + 24 }}
      width={width}
      height={height}
    />
  );
}
