// A punchier two-tone gradient reserved for standout CTAs, distinct from
// the flat amber `.btn-primary` used everywhere else in the app.
export const BRAND_GRADIENT = 'linear-gradient(135deg, #f5a623 0%, #ec4899 100%)';

export default function GradientButton({ as: As = 'button', className = '', style = {}, children, ...props }) {
  return (
    <As
      className={`inline-flex items-center justify-center font-display font-semibold text-void
                  rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${className}`}
      style={{ background: BRAND_GRADIENT, boxShadow: '0 8px 24px -8px rgba(236,72,153,0.5)', ...style }}
      {...props}
    >
      {children}
    </As>
  );
}
