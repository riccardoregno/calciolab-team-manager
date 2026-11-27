import { useState } from "react";
import { Play } from "lucide-react";
import "./product-intro-video.css";

const media = (import.meta.env?.BASE_URL ?? "/") + "brand/intro/";
const poster = media + "calciolab-cover.webp";

export default function ProductIntroVideo() {
  const [started, setStarted] = useState(false);

  return (
    <figure id="video-presentazione" className="cl-intro-video">
      {started ? (
        <video
          controls
          autoPlay
          playsInline
          preload="metadata"
          poster={poster}
          aria-label="CalcioLab in azione"
          ref={(element) => element?.focus({ preventScroll: true })}
        >
          <source src={media + "calciolab-presentazione.mp4"} type="video/mp4" />
          <track kind="captions" label="Italiano" srcLang="it" src={media + "calciolab-it.vtt"} default />
          <a href={media + "calciolab-presentazione.mp4"}>Apri il video CalcioLab</a>
        </video>
      ) : (
        <button type="button" className="cl-intro-video-play" onClick={() => setStarted(true)}>
          <img src={poster} alt="" width="1280" height="720" />
          <span>
            <Play size={19} fill="currentColor" aria-hidden="true" />
            Guarda CalcioLab in azione
          </span>
        </button>
      )}
      <figcaption>40 secondi · Voce e sottotitoli in italiano</figcaption>
    </figure>
  );
}
