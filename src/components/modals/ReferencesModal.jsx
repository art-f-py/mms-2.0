import { useTranslation } from "react-i18next";
import Modal from "./Modal";

// Referências em ordem; `link` é exibido como âncora clicável quando presente
const REFERENCES = [
  {
    text: "BIENIAWSKI, Z. T. Engineering Rock Mass Classifications: A Complete Manual for Engineers and Geologists in Mining, Civil, and Petroleum Engineering. John Wiley & Sons, 1989.",
  },
  {
    text: "MILLER, T. L.; PAKALNIS, R.; POULIN, R. UBC Mining Method Selection. University of British Columbia, Vancouver, B.C., Canada, 1995.",
  },
  {
    text: "NICHOLAS, D. E. Method Selection - A Numerical Approach. In: DESIGN AND OPERATION OF CAVING AND SUBLEVEL STOPING MINE. Stewart, Daniel R. ed. New York: SME-AIME, 1981.",
  },
  {
    text: "NICHOLAS, D. E. Selection Procedure. In: MINING ENGINEERING HANDBOOK. 2nd ed. Littleton, Colorado: SME, 1992. v. 2, p. 2090–2106.",
  },
  {
    text: "SHAHRIAR, K. et al. A New Numerical Method and AHP for Mining Method Selection. In: 4th Int. Symp. on High Performance Mine Production, 2007. p. 289–306.",
    linkLabel: "Link",
    link: "https://www.researchgate.net/publication/279188649",
  },
  {
    text: "HOEK, E.; CARTER, T. G.; DIEDERICHS, M. S. Quantification of the geological strength index chart. In: 47th US Rock Mechanics/Geomechanics Symposium, 2013. p. 1757–1764.",
  },
  {
    text: "PALMSTRÖM, A. Combining the RMR, Q, and RMi classification systems. Tunnelling and Underground Space Technology, v. 24, n. 4, p. 491–492, 2009.",
    linkLabel: "DOI",
    link: "https://doi.org/10.1016/j.tust.2008.12.002",
  },
  {
    text: "RIBEIRO, M. C. de C. R.; ALVES, A. da S. Aplicação do método AHP com mensuração absoluta num problema de seleção qualitativa. Sistemas & Gestão, v. 11, n. 3, p. 270–281, 2016.",
    linkLabel: "DOI",
    link: "https://doi.org/10.20985/1980-5160.2016.v11n3.988",
  },
  {
    text: "SAATY, T. L. How to make a decision: The Analytic Hierarchy Process. European Journal of Operational Research, 1990.",
    linkLabel: "DOI",
    link: "https://doi.org/10.1016/0377-2217(90)90057-I",
  },
  {
    text: "TENZER, R. et al. A digital rock density map of New Zealand. Computers & Geosciences, v. 37, n. 8, p. 1181–1191, 2011.",
    linkLabel: "DOI",
    link: "https://doi.org/10.1016/j.cageo.2010.07.010",
  },
];

export default function ReferencesModal({ onClose }) {
  const { t } = useTranslation();
  return (
    <Modal title={t("modals.references.title")} onClose={onClose} maxWidth="640px">
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {REFERENCES.map((ref, i) => (
          <li
            key={i}
            style={{
              fontSize: "13px",
              lineHeight: 1.55,
              color: "var(--text)",
              padding: "14px 0",
              borderBottom: i < REFERENCES.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            {ref.text}
            {ref.link && (
              <>
                {" "}
                <a
                  href={ref.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--primary-lt)", fontWeight: 600, wordBreak: "break-all" }}
                >
                  {ref.linkLabel}: {ref.link}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
