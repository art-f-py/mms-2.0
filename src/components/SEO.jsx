import { Helmet } from 'react-helmet-async';

export function SEO({
  title       = "MMS 2.0 — Mining Method Selection Tool",
  description = "Ferramenta web de suporte à decisão para seleção de métodos de lavra subterrânea, implementando os algoritmos UBC (1995), Nicholas (1981/1992) e SH&B (2007) com ponderação por critério e comparação entre métodos.",
  url         = "https://art-f-py.github.io/mms-2.0/",
  image       = "https://art-f-py.github.io/mms-2.0/preview-placeholder.png",
  author      = "Artur Feijó — LAPROM/UFRGS",
  keywords    = "mining method selection, seleção de métodos de lavra, UBC 1995, Nicholas 1981, Nicholas 1992, SH&B 2007, mineração subterrânea, engenharia de minas, RMR, RSS, mining engineering, underground mining, LAPROM, UFRGS",
}) {
  return (
    <Helmet>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="generator" content="React" />
      <meta name="application-name" content={title} />
      <meta name="color-scheme" content="light" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={url} />
      <meta name="theme-color" content="#1e3a5f" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={title} />
      <meta property="og:locale" content="pt_BR" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="apple-mobile-web-app-title" content={title} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    </Helmet>
  );
}
