import { Icon } from "@/components/ui";

interface ValueProp {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
}

const VALUE_PROPS: ValueProp[] = [
  {
    icon: "timeline",
    iconBg: "bg-primary-soft",
    iconColor: "text-primary-container",
    title: "Cerita Tetap Nyambung",
    description:
      "Workspace membantu mencatat detail penting. Kurangi risiko cerita yang tidak nyambung antar bab.",
  },
  {
    icon: "lock",
    iconBg: "bg-accent-soft",
    iconColor: "text-secondary",
    title: "Rahasia Tidak Bocor Terlalu Cepat",
    description:
      "Atur timeline rahasia. Workspace mengingatkan jika misteri terungkap lebih cepat dari rencana.",
  },
  {
    icon: "smartphone",
    iconBg: "bg-surface-container",
    iconColor: "text-primary-dark",
    title: "Format Enak Dibaca di HP",
    description:
      "Pratinjau bagaimana paragrafmu terlihat di layar ponsel pembaca — ritme serial mobile-friendly.",
  },
  {
    icon: "key",
    iconBg: "bg-success-soft",
    iconColor: "text-tertiary-container",
    title: "Bantu Pembaca Lanjut Unlock",
    description:
      "Bantu merancang hook, kemenangan kecil, dan open loop di akhir bab agar pembaca ingin lanjut.",
  },
];

export function ValuePropsSection() {
  return (
    <section id="kenapa-vibenovel" className="w-full max-w-[1024px] scroll-mt-24">
      <div className="mb-10 text-center">
        <h2 className="mb-2 font-headline-md text-headline-md text-on-surface">
          Kenapa Menulis di VibeNovel?
        </h2>
        <p className="font-body-sm text-body-sm text-muted-text">
          Dirancang khusus untuk ritme penulisan serial panjang.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {VALUE_PROPS.map((prop) => (
          <div
            key={prop.title}
            className="group flex flex-col items-start rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:border-primary-fixed-dim hover:shadow-md"
          >
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${prop.iconBg} ${prop.iconColor}`}
            >
              <Icon name={prop.icon} size={24} />
            </div>
            <h3 className="mb-2 font-label-md text-label-md text-on-surface">{prop.title}</h3>
            <p className="font-body-sm text-body-sm leading-relaxed text-muted-text">
              {prop.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}