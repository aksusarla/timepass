import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CinemaGame from "@/components/CinemaGame";
import { CINEMA_LANGS, getCinemaPack } from "@/content/cinema";
import { getLanguage } from "@/content/languages";

export function generateStaticParams() {
  return CINEMA_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: PageProps<"/cinema/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const language = getLanguage(lang);
  return {
    title: language ? `Daily ${language.name} Cinema` : "Daily Cinema",
    description: "Guess today's movie in 6 clues. New film every midnight IST.",
  };
}

export default async function CinemaPage({ params }: PageProps<"/cinema/[lang]">) {
  const { lang } = await params;
  const pack = getCinemaPack(lang);
  const language = getLanguage(lang);
  if (!pack || !language) notFound();

  return <CinemaGame pack={pack} language={language} />;
}
