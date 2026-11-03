/* RU | EN capsule toggle (the choice is saved by src/i18n.js) */
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n.js';

export default function LangSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      {LANGUAGES.map((lng, i) => [
        i > 0 && <span key={`sep-${lng}`} className="sep" aria-hidden="true">|</span>,
        <button
          key={lng} type="button" lang={lng} aria-pressed={String(i18n.language === lng)}
          title={t(`lang.${lng}`)} aria-label={t(`lang.${lng}`)}
          onClick={() => i18n.changeLanguage(lng)}
        >{lng.toUpperCase()}</button>,
      ])}
    </div>
  );
}
