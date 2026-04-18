// src/app/about/page.tsx
// Public About page for Aloyon Optical.
// Shows basic clinic information, story, services, and contact details.

export default function AboutPage() {
  return (
    <div className="space-y-16">
      {/* Intro section with clinic name and short tagline */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          About <span style={{ color: "var(--primary)" }}>Aloyon Optical</span>
        </h1>
        <p className="text-muted leading-relaxed">
          We combine modern eye care with a friendly, patient-first approach.
          Whether you need an exam, new frames, or ongoing care,
          we’re here to support your vision journey.
        </p>
      </section>

      {/* Clinic story and front photo */}
      <section className="grid md:grid-cols-2 gap-10 items-center">
        <img
          src="/aloyon-front.jpg"
          alt="Optical Shop"
          className="card w-full h-64 object-cover"
        />
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Our Story</h2>
          <p className="text-muted leading-relaxed">
            Aloyon Optical was founded with the goal of making
            quality vision care accessible to everyone.
            Our clinic combines professional expertise with
            personalized attention, ensuring each patient
            receives care that fits their lifestyle.
          </p>
        </div>
      </section>

      {/* Short list of reasons to choose the clinic */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-center">Why Choose Us?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6 space-y-2">
            <h3 className="font-semibold">👓 Comprehensive Eye Exams</h3>
            <p className="text-muted">
              Our team uses modern equipment to ensure accurate prescriptions
              and early detection of eye conditions.
            </p>
          </div>
          <div className="card p-6 space-y-2">
            <h3 className="font-semibold">🕶 Wide Eyewear Selection</h3>
            <p className="text-muted">
              From designer frames to budget-friendly options, we offer eyewear
              that matches every style and need.
            </p>
          </div>
          <div className="card p-6 space-y-2">
            <h3 className="font-semibold">💡 Personalized Care</h3>
            <p className="text-muted">
              We take time to understand your vision concerns
              and provide tailored solutions.
            </p>
          </div>
          <div className="card p-6 space-y-2">
            <h3 className="font-semibold">❤️ Trusted by Families</h3>
            <p className="text-muted">
              Generations of families trust Aloyon Optical for reliable,
              compassionate, and professional care.
            </p>
          </div>
        </div>
      </section>

      {/* Contact details and map embed */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-center">Contact Us</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Basic contact information */}
          <div className="card p-6 space-y-4">
            <p>
              <strong>Address:</strong> 386 J luna extension Mandaluyong City,
              Philippines
            </p>
            <p>
              <strong>Phone:</strong>{" "}
              <a href="tel:+639123456789" className="link-muted">
                +63 912 345 6789
              </a>
            </p>
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:susan.aloyon@yahoo.com"
                className="link-muted"
              >
                susan.aloyon@yahoo.com
              </a>
            </p>
            <p>
              <strong>Clinic Hours:</strong>
              <br />
              Mon–Sat: 9:00 AM – 5:00 PM
              <br />
              Sun: Closed
            </p>
          </div>

          {/* Google Maps iframe pinned to clinic address */}
          <div className="card overflow-hidden">
            <iframe
              title="Aloyon Optical Location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3861.4352406492827!2d121.0300456!3d14.5909207!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c959e1562487%3A0x60f34a54dd29b242!2sAloyon%20Optical!5e0!3m2!1sen!2sph!4v1694789935463!5m2!1sen!2sph"
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </section>
    </div>
  );
}
