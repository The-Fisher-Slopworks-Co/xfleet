import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { cn } from "@/lib/utils";
import { Kbd } from "../components/terminal/Kbd";
import { UrlBlock } from "../components/terminal/UrlBlock";

const IOS_URL = "https://apps.apple.com/en/app/v2raytun/id6476628951";
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.v2raytun.android";

type AltApp = { name: string; platforms: string; url: string };
const ALT_APPS: AltApp[] = [
  { name: "v2rayNG", platforms: "Android", url: "https://github.com/2dust/v2rayNG" },
  { name: "NekoBox", platforms: "Android", url: "https://github.com/MatsuriDayo/NekoBoxForAndroid" },
  { name: "Hiddify", platforms: "iOS · Android · Desktop", url: "https://hiddify.com/" },
  { name: "Throne", platforms: "Desktop", url: "https://github.com/throneproj/Throne" },
];

type Lang = "ru" | "en";
type Data = { username: string; subUrl: string };

export function InstallPage() {
  const { token } = useParams<{ token: string }>();
  const [lang, setLang] = useState<Lang>("ru");
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<Data>(`/api/public/sub/${token}`)
      .then(setData)
      .catch(() => setNotFound(true));
    if (location.pathname !== `/sub/${token}`) {
      history.replaceState(null, "", `/sub/${token}`);
    }
  }, [token]);

  if (notFound) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="text-muted-foreground">! unknown subscription token</div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="text-muted-foreground">booting...</div>
      </main>
    );
  }

  const t = TEXT[lang];
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-4 py-2 flex items-center justify-between text-sm">
        <div className="text-primary">
          <span className="text-muted-foreground">{data.username}@xfleet:</span>
          <span>~/sub</span>
          <span className="caret" />
        </div>
        <div className="text-primary">[ v2raytun ]</div>
      </header>
      <main className="flex-1 max-w-2xl w-full mx-auto p-6">
        <h1 className="text-lg font-medium mb-6">
          <span className="text-primary">$</span> install v2raytun
        </h1>

        <a
          href={`/sub/${token}?sudo=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mb-5 border border-primary text-primary text-xs px-3 py-1.5 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_12px_-2px_var(--primary)] transition-all"
        >
          [ sudo show configs ]
        </a>

        <LangBar lang={lang} onChange={setLang} />

        <Section variant="recommended" tag={t.tagRecommended} title={t.recTitle}>
          <ol className="list-decimal pl-5 ml-4 space-y-2.5 marker:text-muted-foreground">
            <li>
              {t.step1}
              <div className="flex flex-wrap gap-2 mt-2">
                <StoreLink href={IOS_URL}>[ iOS · App Store ]</StoreLink>
                <StoreLink href={ANDROID_URL}>[ Android · Google Play ]</StoreLink>
              </div>
            </li>
            <li>
              {t.step2}
              <UrlBlock url={data.subUrl} className="mt-1.5" />
            </li>
            <li>{t.step3}</li>
            <li>
              {t.step4Pre} <Kbd>+</Kbd> {t.step4Post}
            </li>
            <li>
              {t.step5Pre} <b className="text-foreground">{t.step5Bold}</b>{t.step5Post}
            </li>
          </ol>
        </Section>

        <Section variant="recommended" tag={t.tagTest} title={t.testTitle}>
          <ol className="list-decimal pl-5 ml-4 space-y-2.5 marker:text-muted-foreground">
            <li>
              {t.testStep1Pre} <Kbd>⋮</Kbd> {t.testStep1Post}
            </li>
            <li>
              {t.testStep2Pre} <b className="text-foreground">{t.testStep2Bold}</b>{t.testStep2Post}
            </li>
            <li>
              {t.testStep3Pre}{" "}
              {t.testStep3Green}
              {t.testStep3Mid}{" "}
              <span className="text-destructive">{t.testStep3Dead}</span>
              {t.testStep3Post}
            </li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3">{t.testNote}</p>
        </Section>

        <Section variant="alt" tag={t.tagAlt} title={t.altTitle}>
          <p className="text-xs text-muted-foreground mb-3">{t.altNote}</p>
          <ul className="space-y-1.5">
            {ALT_APPS.map(a => (
              <li key={a.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary border-b border-dashed border-border hover:border-primary hover:text-foreground"
                >
                  {a.name}
                </a>
                <span className="text-muted-foreground text-xs">[ {a.platforms} ]</span>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}

function Section({
  variant,
  tag,
  title,
  children,
}: {
  variant: "recommended" | "alt";
  tag: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "border bg-card p-5 mb-5",
        variant === "alt" ? "border-dashed border-border" : "border-border",
      )}
    >
      <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{tag}</span>
      <h2
        className={cn(
          "mb-3.5 text-sm font-bold tracking-wide",
          variant === "alt" ? "text-foreground" : "text-primary",
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function LangBar({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-2.5 border border-border bg-card px-3.5 py-2.5 mb-5" role="group" aria-label="language">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">// language</span>
      <span className="text-muted-foreground">→</span>
      <LangBtn active={lang === "ru"} onClick={() => onChange("ru")}>[ RU · Русский ]</LangBtn>
      <LangBtn active={lang === "en"} onClick={() => onChange("en")}>[ EN · English ]</LangBtn>
    </div>
  );
}

function LangBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "px-3.5 py-1.5 text-sm border transition-all cursor-pointer",
        active
          ? "bg-primary text-primary-foreground border-primary font-bold shadow-[0_0_14px_-2px_var(--primary)]"
          : "border-border text-primary hover:border-primary hover:shadow-[0_0_12px_-2px_var(--primary)]",
      )}
    >
      {children}
    </button>
  );
}

function StoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block border border-border text-primary text-xs px-3 py-1.5 hover:border-primary hover:text-foreground hover:shadow-[0_0_12px_-2px_var(--primary)] transition-all"
    >
      {children}
    </a>
  );
}

const TEXT: Record<Lang, {
  tagRecommended: string;
  tagTest: string;
  tagAlt: string;
  recTitle: string;
  testTitle: string;
  altTitle: string;
  altNote: string;
  step1: string;
  step2: string;
  step3: string;
  step4Pre: string;
  step4Post: string;
  step5Pre: string;
  step5Bold: string;
  step5Post: string;
  testStep1Pre: string;
  testStep1Post: string;
  testStep2Pre: string;
  testStep2Bold: string;
  testStep2Post: string;
  testStep3Pre: string;
  testStep3Green: string;
  testStep3Mid: string;
  testStep3Dead: string;
  testStep3Post: string;
  testNote: string;
}> = {
  ru: {
    tagRecommended: "// ru · рекомендуется",
    tagTest: "// ru · проверка соединения",
    tagAlt: "// ru · альтернативы",
    recTitle: "установка v2RayTun",
    testTitle: "как проверить все конфиги",
    altTitle: "другие совместимые приложения",
    altNote: "Подписка работает с любым клиентом VLESS/VMess. В каждом из них есть пункт «Добавить подписку / из буфера обмена» — скопируйте ссылку выше и вставьте её в приложение.",
    step1: "Установите приложение:",
    step2: "Скопируйте ссылку:",
    step3: "Откройте приложение v2RayTun.",
    step4Pre: "Нажмите",
    step4Post: "в правом верхнем углу.",
    step5Pre: "Выберите",
    step5Bold: "«Импорт из буфера обмена»",
    step5Post: ".",
    testStep1Pre: "Нажмите",
    testStep1Post: "(три точки по вертикали) в правом верхнем углу.",
    testStep2Pre: "Выберите",
    testStep2Bold: "«Время отклика конфигов»",
    testStep2Post: ".",
    testStep3Pre: "Дождитесь результатов:",
    testStep3Green: "зелёное число",
    testStep3Mid: " (например, 100 ms) — конфиг рабочий;",
    testStep3Dead: "«?ms»",
    testStep3Post: " — конфиг не работает.",
    testNote: "Один и тот же VPN может работать из дома и не работать через мобильный интернет — рекомендуется регулярно проверять соединение.",
  },
  en: {
    tagRecommended: "// en · recommended",
    tagTest: "// en · connection check",
    tagAlt: "// en · alternatives",
    recTitle: "install v2RayTun",
    testTitle: "how to test all configs",
    altTitle: "other compatible apps",
    altNote: "The subscription works with any VLESS/VMess client. Each app has an \"Add subscription / from clipboard\" option — copy the link above and paste it into the app.",
    step1: "Install the app:",
    step2: "Copy the link:",
    step3: "Open the v2RayTun app.",
    step4Pre: "Tap",
    step4Post: "in the top-right corner.",
    step5Pre: "Choose",
    step5Bold: "\"Import config from Clipboard\"",
    step5Post: ".",
    testStep1Pre: "Tap",
    testStep1Post: "(vertical three dots) in the top-right corner.",
    testStep2Pre: "Choose",
    testStep2Bold: "\"Real delay all configuration\"",
    testStep2Post: ".",
    testStep3Pre: "Wait for the results:",
    testStep3Green: "a green number",
    testStep3Mid: " (e.g. 100 ms) means the config works;",
    testStep3Dead: "\"?ms\"",
    testStep3Post: " means the config is not working.",
    testNote: "The same VPN may work at home but fail on mobile data — we recommend checking the connection regularly.",
  },
};
