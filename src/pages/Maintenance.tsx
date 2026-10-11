
export default function Maintenance() {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#f4f6f4] px-5 py-8 text-[#111]">
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-[min(78vw,570px)] w-[min(78vw,570px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dcebe3]"
        aria-hidden="true"
      />

      <div className="relative flex h-[48vh] min-h-[310px] max-h-[560px] w-full max-w-[620px] items-center justify-center">
        <svg
          viewBox="0 0 480 440"
          className="h-full w-full text-[#111]"
          fill="currentColor"
          role="img"
          aria-label="Силуэт рабочего с молотком"
        >
          <ellipse
            cx="235"
            cy="397"
            rx="135"
            ry="13"
            fill="#c8d4cd"
          />

          {/* Молоток */}
          <g transform="rotate(25 352 80)">
            <rect x="342" y="37" width="20" height="118" rx="5" />
            <rect x="306" y="17" width="92" height="28" rx="5" />
          </g>

          {/* Голова */}
          <circle cx="225" cy="109" r="35" />

          {/* Каска */}
          <path d="M186 101 Q191 68 225 67 Q259 68 264 101 Z" />
          <rect x="182" y="98" width="86" height="9" rx="4" />

          {/* Туловище */}
          <path d="M194 143 Q224 132 256 146 L279 241 Q246 263 170 240 L185 158 Z" />

          {/* Рука с молотком */}
          <path d="M253 151 Q272 146 285 129 L311 103 Q319 97 326 105 Q331 111 325 119 L299 159 Q286 180 265 190 L252 177 Z" />

          {/* Вторая рука */}
          <path d="M194 155 Q177 161 165 183 L170 209 L194 230 Q203 235 210 226 Q214 219 206 213 L192 199 L208 177 Z" />

          {/* Левая нога */}
          <path d="M181 237 L218 246 L209 311 L178 366 L153 356 L171 300 Z" />
          <path d="M178 355 L197 365 L183 390 L139 390 Q131 384 143 375 Z" />

          {/* Правая нога */}
          <path d="M239 246 L274 238 L287 301 L330 339 L313 359 L265 335 L238 286 Z" />
          <path d="M310 347 L330 337 L354 361 Q360 370 348 374 L309 365 L298 357 Z" />

          {/* Рабочий комбинезон */}
          <path
            d="M199 161 L218 184 L240 162 L252 178 L237 212 L240 242 L215 244 L213 214 L195 181 Z"
            fill="#f4f6f4"
          />
        </svg>
      </div>

      <section className="relative z-10 mt-5 max-w-xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-black/55">
          <span className="h-2 w-2 rounded-full bg-[#111]" />
          TeleChatYou
        </div>

        <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
          На сервере ведутся
          <br />
          технические работы
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-black/55 sm:text-base">
          Мы обновляем мессенджер, чтобы сделать его лучше.
          Пожалуйста, зайдите немного позже.
        </p>

        <div className="mt-7 flex justify-center gap-2" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-black/25" />
          <span className="h-2 w-2 rounded-full bg-black/55" />
          <span className="h-2 w-2 rounded-full bg-black/25" />
        </div>
      </section>
    </main>
  );
}
