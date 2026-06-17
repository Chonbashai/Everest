import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Toaster } from "./components/Toaster";
import {
  createAppointment,
  fetchDoctors,
  fetchServices,
  fetchSlots,
  getUtmParams,
  normalizePhone,
  reachBookingGoal,
  type Doctor,
  type Service,
  type Slot,
} from "./lib/booking-api";

const fieldClass =
  "w-full px-4 py-3 bg-white border border-brand-muted/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition text-sm";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const formRef = useRef<HTMLFormElement>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const [doctorsData, servicesData] = await Promise.all([fetchDoctors(), fetchServices()]);
        if (cancelled) return;
        setDoctors(doctorsData);
        setServices(servicesData);
      } catch (error) {
        if (cancelled) return;
        setCatalogError(true);
        toast.error("Не удалось загрузить данные для записи", {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAvailableSlots = useCallback(async () => {
    if (!doctorId || !serviceId || !date) {
      setSlots([]);
      setTime("");
      return;
    }

    setTime("");

    setLoadingSlots(true);
    try {
      const available = await fetchSlots(Number(doctorId), Number(serviceId), date);
      setSlots(available);
    } catch (error) {
      setSlots([]);
      toast.error("Не удалось загрузить свободные слоты", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoadingSlots(false);
    }
  }, [doctorId, serviceId, date]);

  useEffect(() => {
    void loadAvailableSlots();
  }, [loadAvailableSlots]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const utm = getUtmParams();

    const payload = {
      clientName: String(formData.get("name") ?? "").trim(),
      phone: normalizePhone(String(formData.get("phone") ?? "")),
      doctorId: Number(formData.get("doctor")),
      serviceId: Number(formData.get("service")),
      date: String(formData.get("date") ?? ""),
      time: String(formData.get("time") ?? ""),
      comment: String(formData.get("comment") ?? "").trim() || undefined,
      utmSource: utm.source,
      utmMedium: utm.medium,
      utmCampaign: utm.campaign,
      utmContent: utm.content,
      utmTerm: utm.term,
    };

    if (
      !payload.clientName ||
      !payload.phone ||
      !payload.doctorId ||
      !payload.serviceId ||
      !payload.date ||
      !payload.time
    ) {
      toast.error("Проверьте заполнение всех полей формы");
      return;
    }

    setSubmitting(true);
    try {
      await createAppointment(payload);
      reachBookingGoal();
      toast.success("Заявка отправлена", {
        description: "Администратор свяжется с вами для подтверждения записи.",
      });
      form.reset();
      setDoctorId("");
      setServiceId("");
      setDate("");
      setTime("");
      setSlots([]);
    } catch (error) {
      if (error instanceof Error && error.message === "SLOT_TAKEN") {
        toast.error("Этот слот уже занят", {
          description: "Выберите другое время.",
        });
        await loadAvailableSlots();
        return;
      }
      toast.error("Ошибка отправки", {
        description:
          error instanceof Error ? error.message : "Попробуйте снова через минуту.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const slotsDisabled = !doctorId || !serviceId || !date || loadingSlots;
  const formDisabled = catalogError || loadingCatalog;

  return (
    <div className="min-h-screen bg-brand-light text-neutral-900 font-sans selection:bg-brand-primary/10">
      <header className="sticky top-0 z-50 bg-brand-light/80 backdrop-blur-md border-b border-brand-muted/30">
        <div className="max-w-7xl mx-auto px-6 h-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-8">
            <a href="https://everestmed.ru" className="flex items-center gap-2 shrink-0">
              <div className="size-8 bg-brand-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold text-xs">ЭМ</span>
              </div>
              <span className="text-xl font-medium tracking-tight text-brand-deep">ЭВЕРЕСТ</span>
            </a>
            <nav className="hidden md:flex items-center gap-6">
              <a
                href="https://everestmed.ru"
                className="text-sm font-medium text-neutral-600 hover:text-brand-primary transition-colors"
              >
                Главная
              </a>
              <a
                href="#benefits"
                className="text-sm font-medium text-neutral-600 hover:text-brand-primary transition-colors"
              >
                О клинике
              </a>
              <a
                href="#contacts"
                className="text-sm font-medium text-neutral-600 hover:text-brand-primary transition-colors"
              >
                Контакты
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex flex-col items-end">
              <a href="tel:+79138656768" className="text-sm font-semibold text-brand-deep">
                +7 (913) 865-67-68
              </a>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                Ежедневно 09:00 — 21:00
              </span>
            </div>
            <a
              href="tel:+79138656768"
              className="bg-brand-primary text-white text-sm font-medium py-2 pr-3 pl-2 inline-flex items-center gap-2 rounded-xl ring-1 ring-brand-primary hover:bg-brand-deep transition-colors"
            >
              <svg
                className="size-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
              Позвонить
            </a>
          </div>
        </div>
      </header>

      <section className="pt-20 pb-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary mb-4">
            Онлайн-запись
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-brand-deep leading-tight text-balance mb-6">
            Ваше здоровье и красота начинаются здесь
          </h1>
          <p className="text-neutral-600 max-w-[56ch] mx-auto text-pretty text-lg">
            Запишитесь на приём в центр эстетики и красоты «Эверест Мед» в несколько кликов — администратор
            подтвердит запись на выбранную услугу.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-neutral-card rounded-[24px] ring-1 ring-black/5 p-8 md:p-12 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <div className="size-40 border-2 border-brand-primary rotate-45" />
            </div>

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-500 ml-1">Ваше имя</label>
                <input
                  required
                  name="name"
                  type="text"
                  minLength={2}
                  maxLength={80}
                  disabled={formDisabled}
                  placeholder="Иван Иванов"
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-500 ml-1">Телефон</label>
                <input
                  required
                  name="phone"
                  type="tel"
                  disabled={formDisabled}
                  placeholder="+7 (___) ___-__-__"
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-500 ml-1">Выберите врача</label>
                <select
                  required
                  name="doctor"
                  value={doctorId}
                  disabled={formDisabled}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="" disabled>
                    {loadingCatalog ? "Загрузка врачей..." : "Выберите врача"}
                  </option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} ({doctor.specialization})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-500 ml-1">Услуга</label>
                <select
                  required
                  name="service"
                  value={serviceId}
                  disabled={formDisabled}
                  onChange={(e) => setServiceId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="" disabled>
                    {loadingCatalog ? "Загрузка услуг..." : "Выберите услугу"}
                  </option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.title} ({service.durationMinutes} мин.)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-500 ml-1">Дата приёма</label>
                <input
                  required
                  name="date"
                  type="date"
                  min={todayIso()}
                  value={date}
                  disabled={formDisabled}
                  onChange={(e) => setDate(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-500 ml-1">Желаемое время</label>
                <select
                  required
                  name="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={slotsDisabled || formDisabled}
                  className={fieldClass}
                >
                  <option value="" disabled>
                    {!doctorId || !serviceId || !date
                      ? "Сначала выберите врача, услугу и дату"
                      : loadingSlots
                        ? "Загрузка свободных слотов..."
                        : slots.length === 0
                          ? "Нет свободных слотов на эту дату"
                          : "Выберите время"}
                  </option>
                  {slots.map((slot) => (
                    <option key={slot.time} value={slot.time}>
                      {slot.time}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-medium text-neutral-500 ml-1">
                  Комментарий (необязательно)
                </label>
                <textarea
                  name="comment"
                  rows={3}
                  maxLength={500}
                  disabled={formDisabled}
                  placeholder="Опишите ваши пожелания или вопросы..."
                  className={`${fieldClass} resize-none`}
                />
              </div>
              <div className="md:col-span-2 pt-4">
                <button
                  type="submit"
                  disabled={submitting || formDisabled}
                  className="w-full bg-brand-primary text-white font-medium py-4 px-6 rounded-2xl ring-1 ring-brand-primary hover:bg-brand-deep transition-colors shadow-lg shadow-brand-primary/10 disabled:opacity-60"
                >
                  {submitting ? "Отправляем..." : "Записаться на приём"}
                </button>
                <p className="text-[11px] text-center text-neutral-400 mt-4">
                  Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности и обработки персональных
                  данных
                </p>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section id="benefits" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-16 items-start">
            <div className="md:w-1/3">
              <h2 className="text-3xl font-medium text-brand-deep text-balance leading-tight mb-4">
                Почему выбирают «Эверест Мед»
              </h2>
              <p className="text-neutral-500 text-sm max-w-[35ch] text-pretty">
                Мы создали пространство, где медицинская экспертиза встречается с исключительным комфортом.
              </p>
            </div>
            <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
              {[
                {
                  title: "Опытные врачи",
                  text: "Все наши специалисты имеют высшую категорию и регулярно проходят обучение.",
                },
                {
                  title: "Безопасность",
                  text: "Используем только сертифицированное оборудование и проверенные методики.",
                },
                {
                  title: "Современные технологии",
                  text: "Аппаратные решения экспертного класса для высоких эстетических результатов.",
                },
                {
                  title: "Индивидуальный подход",
                  text: "Программы омоложения и оздоровления подбираются под вашу задачу.",
                },
              ].map((b) => (
                <div key={b.title} className="flex flex-col gap-4">
                  <div className="size-10 rounded-full bg-brand-light flex items-center justify-center text-brand-primary">
                    <svg
                      className="size-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-brand-deep">{b.title}</h3>
                  <p className="text-sm text-neutral-600 leading-relaxed text-pretty">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-brand-light">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-medium text-brand-deep mb-16">Как проходит запись</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { n: 1, t: "Заполните форму", d: "Выберите удобное время и нужную услугу онлайн." },
              { n: 2, t: "Подтверждение", d: "Администратор свяжется для уточнения деталей." },
              { n: 3, t: "Визит в клинику", d: "Приходите в назначенное время — мы вас ждём." },
            ].map((s) => (
              <div key={s.n} className="relative flex flex-col items-center">
                <div className="size-16 rounded-2xl bg-white ring-1 ring-black/5 flex items-center justify-center text-xl font-medium text-brand-primary mb-6 shadow-sm">
                  {s.n}
                </div>
                <h3 className="text-lg font-medium mb-3">{s.t}</h3>
                <p className="text-sm text-neutral-500 max-w-[28ch] text-pretty">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contacts" className="py-24 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-12 bg-white rounded-[32px] overflow-hidden ring-1 ring-black/5 shadow-sm">
          <div className="md:w-1/2 p-12">
            <h2 className="text-3xl font-medium text-brand-deep mb-8">Контакты</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="size-5 text-brand-primary mt-0.5 shrink-0">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">Город Томск</p>
                  <p className="text-sm text-neutral-500">ул. Вокзальная, 21</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="size-5 text-brand-primary mt-0.5 shrink-0">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">Режим работы</p>
                  <p className="text-sm text-neutral-500">Пн—Вс: 09:00 — 21:00</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="size-5 text-brand-primary mt-0.5 shrink-0">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                    />
                  </svg>
                </div>
                <div>
                  <a
                    href="tel:+79138656768"
                    className="text-sm font-medium text-neutral-900 hover:text-brand-primary"
                  >
                    +7 (913) 865-67-68
                  </a>
                  <p className="text-sm text-neutral-500">everest-med@mail.ru</p>
                </div>
              </div>
            </div>
          </div>
          <div className="md:w-1/2 bg-brand-muted/20 relative min-h-[320px] grid place-items-center">
            <div className="text-center px-8">
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-brand-primary mb-3">
                Карта
              </div>
              <p className="text-sm text-neutral-500 max-w-[28ch] mx-auto">
                г. Томск, ул. Вокзальная, 21 — медицинский центр «Эверест Мед»
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-brand-muted/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-60">
            <div className="size-6 bg-brand-deep rounded flex items-center justify-center">
              <span className="text-white font-semibold text-[10px]">ЭМ</span>
            </div>
            <span className="text-sm font-medium tracking-tight text-brand-deep">ЭВЕРЕСТ МЕД</span>
          </div>
          <div className="text-xs text-neutral-400">© 2026 «Эверест Мед». Все права защищены.</div>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-neutral-500 hover:text-brand-primary transition-colors">
              Политика конфиденциальности
            </a>
            <a
              href="https://everestmed.ru"
              className="text-xs text-neutral-500 hover:text-brand-primary transition-colors"
            >
              everestmed.ru
            </a>
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
