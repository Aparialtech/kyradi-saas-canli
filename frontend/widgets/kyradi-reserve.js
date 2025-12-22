(function () {
  const script = document.currentScript;
  const scriptBase = script && script.src ? script.src.replace(/\/[^/]+$/, "/") : "";

  function injectStyles() {
    if (document.getElementById("kyradi-reserve-style")) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.id = "kyradi-reserve-style";
    // Try to find styles.css relative to script location or use /widgets/styles.css
    const stylePath = (script && script.getAttribute("data-style-src")) || 
                      (scriptBase ? `${scriptBase}styles.css` : "/widgets/styles.css");
    link.href = stylePath;
    document.head.appendChild(link);
  }

  const translations = {
    "tr-tr": {
      title: "Rezervasyon Formu",
      personalInfo: "Kişisel Bilgiler",
      accommodationInfo: "Konaklama Bilgileri",
      luggageInfo: "Bavul Bilgileri",
      consents: "Onaylar",
      fullName: "Ad Soyad",
      fullNamePlaceholder: "Ad Soyad",
      tcIdentityNumber: "TC Kimlik No",
      tcIdentityNumberPlaceholder: "TC Kimlik No (11 haneli)",
      tcIdentityNumberHelper: "11 haneli TC Kimlik numaranızı giriniz",
      idType: "Kimlik Türü",
      idTypeSelect: "Seçiniz",
      passportNumber: "Pasaport No",
      passportNumberPlaceholder: "Yabancı misafirler için pasaport no",
      amount: "Tutar",
      phoneNumber: "Telefon Numarası",
      phoneNumberPlaceholder: "Telefon Numarası",
      email: "E-posta",
      emailPlaceholder: "E-posta",
      hotelRoomNumber: "Oda Numarası",
      hotelRoomNumberPlaceholder: "Oda Numarası (Opsiyonel)",
      checkin: "Giriş Tarihi",
      checkout: "Çıkış Tarihi",
      checkinDateTime: "Giriş Tarih ve Saati",
      checkoutDateTime: "Çıkış Tarih ve Saati",
      durationHours: "Süre (Saat)",
      estimatedPrice: "Tahmini Fiyat",
      luggageCount: "Bavul Sayısı",
      luggageType: "Bavul Türü",
      luggageTypeSelect: "Seçiniz",
      luggageTypeCabin: "Kabin",
      luggageTypeMedium: "Orta",
      luggageTypeLarge: "Büyük",
      luggageTypeBackpack: "Sırt Çantası",
      luggageTypeOther: "Diğer",
      luggageDescription: "Bavul Özeti / İçerik Açıklaması",
      luggageDescriptionPlaceholder: "Örn: 2 adet büyük valiz, 1 sırt çantası…",
      notes: "Notlar",
      notesPlaceholder: "Örneğin: Geç giriş yapılacak...",
      kvkkConsent: "KVKK kapsamında kişisel verilerimin işlenmesini kabul ediyorum.",
      termsConsent: "Depo kullanım şartlarını okudum ve kabul ediyorum.",
      disclosureConsent: "Aydınlatma Metni'ni okudum, bilgilendirildim.",
      baggage: "Bavul Sayısı",
      guestName: "Ad Soyad",
      guestEmail: "E-posta",
      guestPhone: "Telefon",
      consent: "KVKK/GDPR onayını kabul ediyorum.",
      submit: "Rezervasyonu Gönder",
      success: "Rezervasyonunuz alınmıştır.",
      reservationId: "Rezervasyon ID",
      newReservation: "Yeni Rezervasyon",
      error: "İşlem tamamlanamadı. Lütfen daha sonra tekrar deneyin.",
      unauthorized: "Bu alan adı için yetki bulunamadı.",
      required: "Bu alan zorunlu.",
      invalidTCKN: "Lütfen geçerli bir T.C. Kimlik Numarası girin.",
      invalidPhone: "Geçersiz telefon numarası (min 10 haneli olmalı).",
      invalidEmail: "Geçersiz e-posta formatı.",
      pastDate: "Geçmiş bir tarih seçilemez.",
      checkoutBeforeCheckin: "Çıkış tarihi, giriş tarihinden önce olamaz.",
      invalidLuggageCount: "Bavul sayısı en az 1 olmalıdır.",
      consentRequired: "Tüm onay kutularını işaretlemeniz gerekmektedir.",
      kvkkConsentRequired: "Devam edebilmek için KVKK onayını vermelisiniz.",
      disclosureConsentRequired: "Devam edebilmek için Aydınlatma Metni'ni okuduğunuzu onaylamalısınız.",
      hours: "saat",
    },
    "en-us": {
      title: "Reservation Form",
      personalInfo: "Personal Information",
      accommodationInfo: "Accommodation Information",
      luggageInfo: "Luggage Information",
      consents: "Consents",
      fullName: "Full Name",
      fullNamePlaceholder: "Full Name",
      tcIdentityNumber: "National ID (Turkey)",
      tcIdentityNumberPlaceholder: "Turkish National ID (11 digits)",
      tcIdentityNumberHelper: "Enter your 11-digit Turkish National ID",
      idType: "ID Type",
      idTypeSelect: "Select",
      passportNumber: "Passport Number",
      passportNumberPlaceholder: "Passport number for foreign guests",
      amount: "Amount",
      phoneNumber: "Phone Number",
      phoneNumberPlaceholder: "Phone Number",
      email: "Email",
      emailPlaceholder: "Email",
      hotelRoomNumber: "Room Number",
      hotelRoomNumberPlaceholder: "Room Number (Optional)",
      checkin: "Check-in Date",
      checkout: "Check-out Date",
      checkinDateTime: "Check-in Date & Time",
      checkoutDateTime: "Check-out Date & Time",
      durationHours: "Duration (Hours)",
      estimatedPrice: "Estimated Price",
      luggageCount: "Number of Bags",
      luggageType: "Luggage Type",
      luggageTypeSelect: "Select",
      luggageTypeCabin: "Cabin",
      luggageTypeMedium: "Medium",
      luggageTypeLarge: "Large",
      luggageTypeBackpack: "Backpack",
      luggageTypeOther: "Other",
      luggageDescription: "Luggage Summary / Content Description",
      luggageDescriptionPlaceholder: "e.g. 2 large suitcases, 1 backpack…",
      notes: "Notes",
      notesPlaceholder: "e.g. Late evening arrival...",
      kvkkConsent: "I accept the processing of my personal data under KVKK.",
      termsConsent: "I have read and accept the storage terms and conditions.",
      disclosureConsent: "I have read and been informed about the Disclosure Text.",
      baggage: "Number of Bags",
      guestName: "Full Name",
      guestEmail: "Email",
      guestPhone: "Phone",
      consent: "I agree to the privacy policy.",
      submit: "Submit Reservation",
      success: "Your reservation has been received.",
      reservationId: "Reservation ID",
      newReservation: "New Reservation",
      error: "Something went wrong. Please try again later.",
      unauthorized: "This domain is not authorized.",
      required: "This field is required.",
      invalidTCKN: "Please enter a valid Turkish ID number.",
      invalidPhone: "Invalid phone number (must be at least 10 digits).",
      invalidEmail: "Invalid email format.",
      pastDate: "Cannot select a past date.",
      checkoutBeforeCheckin: "Checkout date cannot be before check-in date.",
      invalidLuggageCount: "Luggage count must be at least 1.",
      consentRequired: "All consent checkboxes must be checked.",
      kvkkConsentRequired: "You must provide KVKK consent to continue.",
      disclosureConsentRequired: "You must confirm that you have read the Disclosure Text to continue.",
      hours: "hours",
    },
  };

  const globalOptions = {
    apiBase: (script && script.dataset.apiBase) || window.location.origin,
    tenantId: script?.dataset.tenantId || "",
    widgetKey: script?.dataset.widgetKey || "",
    locale: (script?.dataset.locale || "tr-TR").toLowerCase(),
    theme: script?.dataset.theme || "light",
    hcaptchaSitekey: script?.dataset.hcaptchaSitekey || "",
  };

  class KyradiReserveElement extends HTMLElement {
    constructor() {
      super();
      this.state = { loading: true, error: null, successRef: null };
      this.options = {};
      this.accessToken = null;
      this.captchaToken = null;
    }

    connectedCallback() {
      injectStyles();
      this.options = {
        apiBase: this.getAttribute("data-api-base") || globalOptions.apiBase,
        tenantId: this.getAttribute("data-tenant-id") || globalOptions.tenantId,
        widgetKey: this.getAttribute("data-widget-key") || globalOptions.widgetKey,
        locale: (this.getAttribute("data-locale") || globalOptions.locale || "tr-tr").toLowerCase(),
        theme: this.getAttribute("data-theme") || globalOptions.theme || "light",
        hcaptchaSitekey: this.getAttribute("data-hcaptcha-sitekey") || globalOptions.hcaptchaSitekey,
      };
      this.renderLoading();
      this.initialize();
    }

    t(key) {
      const locale = translations[this.options.locale] ? this.options.locale : "tr-tr";
      return translations[locale][key] || translations["tr-tr"][key] || key;
    }

    async initialize() {
      if (!this.options.tenantId || !this.options.widgetKey) {
        this.state = { loading: false, error: this.t("unauthorized") };
        this.render();
        return;
      }

      try {
        const url = new URL("/public/widget/init", this.options.apiBase);
        url.searchParams.set("tenant_id", this.options.tenantId);
        url.searchParams.set("key", this.options.widgetKey);

        const response = await fetch(url.toString(), {
          credentials: "include",
          headers: {
            Origin: window.location.origin,
          },
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = await response.json();
        this.accessToken = data.access_token;
        this.kvkkText = data.kvkk_text;
        this.options.locale = (data.locale || this.options.locale || "tr-tr").toLowerCase();
        this.state = { loading: false, error: null, successRef: null };
        this.render();
        await this.setupCaptcha();
      } catch (error) {
        this.state = { loading: false, error: this.t("unauthorized") };
        this.render();
      }
    }

    async setupCaptcha() {
      if (!this.options.hcaptchaSitekey) return;
      await loadHCaptcha();
      const container = this.querySelector(".kyradi-reserve__captcha");
      if (!container) return;
      window.hcaptcha.render(container, {
        sitekey: this.options.hcaptchaSitekey,
        callback: (token) => {
          this.captchaToken = token;
        },
      });
    }

    renderLoading() {
      this.innerHTML = `<div class="kyradi-reserve kyradi-reserve--${this.options.theme}"><p class="kyradi-reserve__status">${this.t(
        "title",
      )}</p><p class="kyradi-reserve__muted">...</p></div>`;
    }

    render() {
      if (this.state.loading) {
        this.renderLoading();
        return;
      }

      if (this.state.error) {
        this.innerHTML = `<div class="kyradi-reserve kyradi-reserve--${this.options.theme}"><p class="kyradi-reserve__error">${this.state.error}</p></div>`;
        return;
      }

      if (this.state.successRef) {
        this.innerHTML = `<div class="kyradi-reserve kyradi-reserve--${this.options.theme}">
          <p class="kyradi-reserve__status">${this.t("success")}</p>
          <p class="kyradi-reserve__muted">#${this.state.successRef}</p>
          <button class="kyradi-reserve__button" data-role="reset">${this.t("submit")}</button>
        </div>`;
        this.querySelector("[data-role='reset']")?.addEventListener("click", () => {
          this.state.successRef = null;
          this.render();
        });
        return;
      }

      // Get current datetime in local timezone for datetime-local input
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const minDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
      
      this.innerHTML = `
        <div class="kyradi-reserve kyradi-reserve--${this.options.theme}">
          <h3 class="kyradi-reserve__title">${this.t("title")}</h3>
          <form class="kyradi-reserve__form" novalidate>
            <!-- Kişisel Bilgiler -->
            <fieldset class="kyradi-reserve__fieldset">
              <legend class="kyradi-reserve__legend">${this.t("personalInfo")}</legend>
              <div class="kyradi-reserve__grid">
                <label>
                  <span>${this.t("fullName")} <span class="kyradi-reserve__required">*</span></span>
                  <input type="text" name="full_name" required minlength="2" placeholder="${this.t("fullNamePlaceholder")}" />
                </label>
                <label>
                  <span>${this.t("idType")} <span class="kyradi-reserve__required">*</span></span>
                  <select name="id_type" required>
                    <option value="">${this.t("idTypeSelect")}</option>
                    <option value="tc">${this.t("tcIdentityNumber")}</option>
                    <option value="passport">${this.t("passportNumber")}</option>
                  </select>
                </label>
                <label id="tc-field" style="display: none;">
                  <span>${this.t("tcIdentityNumber")} <span class="kyradi-reserve__required">*</span></span>
                  <input type="text" name="tc_identity_number" pattern="[0-9]{11}" maxlength="11" placeholder="${this.t("tcIdentityNumberPlaceholder")}" />
                </label>
                <label id="passport-field" style="display: none;">
                  <span>${this.t("passportNumber")} <span class="kyradi-reserve__required">*</span></span>
                  <input type="text" name="passport_number" maxlength="20" placeholder="${this.t("passportNumberPlaceholder")}" />
                </label>
                <label>
                  <span>${this.t("phoneNumber")} <span class="kyradi-reserve__required">*</span></span>
                  <input type="tel" name="phone_number" required minlength="10" placeholder="${this.t("phoneNumberPlaceholder")}" />
                </label>
                <label>
                  <span>${this.t("email")} <span class="kyradi-reserve__required">*</span></span>
                  <input type="email" name="email" required placeholder="${this.t("emailPlaceholder")}" />
                </label>
              </div>
            </fieldset>
            
            <!-- Tarih ve Bavul -->
            <fieldset class="kyradi-reserve__fieldset">
              <legend class="kyradi-reserve__legend">${this.t("accommodationInfo")} & ${this.t("luggageInfo")}</legend>
              <div class="kyradi-reserve__grid">
                <label>
                  <span>${this.t("checkinDateTime")} <span class="kyradi-reserve__required">*</span></span>
                  <input type="datetime-local" name="start_datetime" required min="${minDateTime}" />
                </label>
                <label>
                  <span>${this.t("checkoutDateTime")} <span class="kyradi-reserve__required">*</span></span>
                  <input type="datetime-local" name="end_datetime" required min="${minDateTime}" />
                </label>
                <label>
                  <span>${this.t("luggageCount")} <span class="kyradi-reserve__required">*</span></span>
                  <input type="number" name="luggage_count" required min="1" max="20" value="1" />
                </label>
                <label>
                  <span>${this.t("luggageType")}</span>
                  <select name="luggage_type">
                    <option value="">${this.t("luggageTypeSelect")}</option>
                    <option value="Kabin">${this.t("luggageTypeCabin")}</option>
                    <option value="Orta">${this.t("luggageTypeMedium")}</option>
                    <option value="Büyük">${this.t("luggageTypeLarge")}</option>
                    <option value="Sırt Çantası">${this.t("luggageTypeBackpack")}</option>
                    <option value="Diğer">${this.t("luggageTypeOther")}</option>
                  </select>
                </label>
                <label>
                  <span>${this.t("hotelRoomNumber")}</span>
                  <input type="text" name="hotel_room_number" maxlength="20" placeholder="${this.t("hotelRoomNumberPlaceholder")}" />
                </label>
                <label>
                  <span>${this.t("amount")}</span>
                  <input type="text" name="estimated_price" readonly class="kyradi-reserve__readonly" placeholder="--" />
                </label>
              </div>
              <div class="kyradi-reserve__grid kyradi-reserve__grid--full" style="margin-top: 12px;">
                <label style="grid-column: 1 / -1;">
                  <span>${this.t("notes")}</span>
                  <textarea name="notes" rows="2" placeholder="${this.t("notesPlaceholder")}"></textarea>
                </label>
              </div>
            </fieldset>
            
            <!-- Onaylar -->
            <fieldset class="kyradi-reserve__fieldset kyradi-reserve__fieldset--consents">
              <legend class="kyradi-reserve__legend">${this.t("consents")}</legend>
              <div class="kyradi-reserve__consents-grid">
                <label class="kyradi-reserve__consent">
                  <input type="checkbox" name="kvkk_consent" required data-contract-type="kvkk" />
                  <span>KVKK Metni <span class="kyradi-reserve__required">*</span></span>
                  <a href="#" class="kyradi-reserve__contract-link" data-contract-type="kvkk">Oku</a>
                </label>
                <label class="kyradi-reserve__consent">
                  <input type="checkbox" name="terms_consent" required data-contract-type="terms" />
                  <span>Kullanım Şartları <span class="kyradi-reserve__required">*</span></span>
                  <a href="#" class="kyradi-reserve__contract-link" data-contract-type="terms">Oku</a>
                </label>
                <label class="kyradi-reserve__consent">
                  <input type="checkbox" name="disclosure_consent" required data-contract-type="disclosure" />
                  <span>Aydınlatma Metni <span class="kyradi-reserve__required">*</span></span>
                  <a href="#" class="kyradi-reserve__contract-link" data-contract-type="disclosure">Oku</a>
                </label>
              </div>
            </fieldset>
            
            <!-- Contract Modal - Premium Design -->
            <div class="kyradi-reserve__modal" id="contract-modal" style="display: none;">
              <div>
                <h3 id="contract-modal-title">Sözleşme</h3>
                <div class="kyradi-reserve__modal-content" id="contract-modal-content"></div>
                <div class="kyradi-reserve__modal-footer">
                  <label class="kyradi-reserve__modal-accept">
                    <input type="checkbox" id="contract-modal-accept" />
                    <span>✓ Yukarıdaki metni okudum ve kabul ediyorum</span>
                  </label>
                  <div class="kyradi-reserve__modal-buttons">
                    <button type="button" id="contract-modal-close" class="kyradi-reserve__modal-btn kyradi-reserve__modal-btn--secondary">Kapat</button>
                    <button type="button" id="contract-modal-confirm" class="kyradi-reserve__modal-btn kyradi-reserve__modal-btn--primary" disabled>✓ Onayla</button>
                  </div>
                </div>
              </div>
            </div>
            
            ${
              this.options.hcaptchaSitekey
                ? '<div class="kyradi-reserve__captcha"></div>'
                : ""
            }
            <button class="kyradi-reserve__button" type="submit">${this.t("submit")}</button>
            <p class="kyradi-reserve__error" data-role="error"></p>
          </form>
        </div>
      `;

      this.querySelector("form")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!this.validateForm(form)) {
          return;
        }
        this.submitForm(new FormData(form));
      });

      // Handle id_type selection to show/hide TC No or Passport fields
      const idTypeSelect = this.querySelector('select[name="id_type"]');
      const tcField = this.querySelector('#tc-field');
      const passportField = this.querySelector('#passport-field');
      const tcInput = this.querySelector('input[name="tc_identity_number"]');
      const passportInput = this.querySelector('input[name="passport_number"]');
      
      const handleIdTypeChange = () => {
        const idType = idTypeSelect.value;
        if (idType === 'tc') {
          tcField.style.display = 'block';
          passportField.style.display = 'none';
          if (tcInput) {
            tcInput.required = true;
          }
          if (passportInput) {
            passportInput.required = false;
            passportInput.value = '';
          }
        } else if (idType === 'passport') {
          tcField.style.display = 'none';
          passportField.style.display = 'block';
          if (tcInput) {
            tcInput.required = false;
            tcInput.value = '';
          }
          if (passportInput) {
            passportInput.required = true;
          }
        } else {
          tcField.style.display = 'none';
          passportField.style.display = 'none';
          if (tcInput) {
            tcInput.required = false;
            tcInput.value = '';
          }
          if (passportInput) {
            passportInput.required = false;
            passportInput.value = '';
          }
        }
      };
      
      if (idTypeSelect) {
        idTypeSelect.addEventListener('change', handleIdTypeChange);
        // Initial state
        handleIdTypeChange();
      }

      // Real-time validation and price calculation: set checkout min datetime based on checkin
      const startInput = this.querySelector('input[name="start_datetime"]');
      const endInput = this.querySelector('input[name="end_datetime"]');
      const durationInput = this.querySelector('input[name="duration_hours"]');
      const priceInput = this.querySelector('input[name="estimated_price"]');
      
      const updateDurationAndPrice = async () => {
        if (startInput && endInput && startInput.value && endInput.value) {
          const start = new Date(startInput.value);
          const end = new Date(endInput.value);
          if (end > start) {
            const hours = (end - start) / (1000 * 60 * 60);
            if (durationInput) {
              durationInput.value = hours.toFixed(2) + ' ' + this.t("hours");
            }
            
            // Get luggage count for pricing
            const luggageInput = this.querySelector('input[name="luggage_count"]');
            const luggageCount = luggageInput ? parseInt(luggageInput.value) || 1 : 1;
            
            // Call backend pricing estimate endpoint
            if (priceInput) {
              priceInput.value = "...";  // Show loading indicator
              
              try {
                const estimateUrl = new URL("/demo/public/price-estimate", this.options.apiBase);
                const response = await fetch(estimateUrl.toString(), {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    tenant_id: this.options.tenantId,
                    start_datetime: start.toISOString(),
                    end_datetime: end.toISOString(),
                    baggage_count: luggageCount,
                  }),
                });
                
                if (response.ok) {
                  const data = await response.json();
                  priceInput.value = data.total_formatted;
                  // Store the estimate for later use
                  this.lastPriceEstimate = data;
                } else {
                  // Fallback to local calculation if API fails
              const estimatedPrice = (hours * 15).toFixed(2);
                  priceInput.value = estimatedPrice + ' ₺ (tahmini)';
                }
              } catch (err) {
                console.warn("Price estimate API call failed:", err);
                // Fallback to local calculation
                const estimatedPrice = (hours * 15).toFixed(2);
                priceInput.value = estimatedPrice + ' ₺ (tahmini)';
              }
            }
          }
        }
      };
      
      // Also update price when luggage count changes
      const luggageCountInput = this.querySelector('input[name="luggage_count"]');
      if (luggageCountInput) {
        luggageCountInput.addEventListener('change', updateDurationAndPrice);
      }
      
      if (startInput && endInput) {
        startInput.addEventListener('change', () => {
          if (startInput.value) {
            endInput.min = startInput.value;
          }
          updateDurationAndPrice();
        });
        endInput.addEventListener('change', updateDurationAndPrice);
      }
      
      // Contract modal handlers
      this.setupContractModals();
    }
    
    async setupContractModals() {
      // Fetch legal texts from backend
      let legalTexts = { kvkk_text: '', aydinlatma_text: '', terms_text: '' };
      try {
        const legalTextsUrl = new URL('/public/legal-texts', this.options.apiBase);
        const response = await fetch(legalTextsUrl.toString());
        if (response.ok) {
          legalTexts = await response.json();
        }
      } catch (err) {
        console.warn('Failed to fetch legal texts:', err);
      }
      
      const contractLinks = this.querySelectorAll('.kyradi-reserve__contract-link');
      const modal = this.querySelector('#contract-modal');
      const modalTitle = this.querySelector('#contract-modal-title');
      const modalContent = this.querySelector('#contract-modal-content');
      const modalAccept = this.querySelector('#contract-modal-accept');
      const modalClose = this.querySelector('#contract-modal-close');
      const modalConfirm = this.querySelector('#contract-modal-confirm');
      
      if (!modal || !modalTitle || !modalContent || !modalAccept || !modalClose || !modalConfirm) return;
      
      const contractTexts = {
        kvkk: legalTexts.kvkk_text || this.kvkkText || 'KVKK metni yüklenemedi.',
        terms: legalTexts.terms_text || 'Depo kullanım şartları ve koşulları burada yer almaktadır. Lütfen dikkatle okuyunuz.',
        disclosure: legalTexts.aydinlatma_text || 'Aydınlatma metni burada yer almaktadır. Lütfen dikkatle okuyunuz.'
      };
      
      const contractTitles = {
        kvkk: 'KVKK Aydınlatma Metni',
        terms: 'Depo Kullanım Şartları',
        disclosure: 'Aydınlatma Metni'
      };
      
      contractLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const contractType = link.getAttribute('data-contract-type');
          modalTitle.textContent = contractTitles[contractType] || 'Sözleşme';
          modalContent.textContent = contractTexts[contractType] || 'Metin yüklenemedi.';
          modalAccept.checked = false;
          modalConfirm.disabled = true;
          modalConfirm.style.opacity = '0.5';
          modal.style.display = 'flex';
        });
      });
      
      modalAccept.addEventListener('change', () => {
        modalConfirm.disabled = !modalAccept.checked;
        modalConfirm.style.opacity = modalAccept.checked ? '1' : '0.5';
        modalConfirm.style.cursor = modalAccept.checked ? 'pointer' : 'not-allowed';
      });
      
      modalClose.addEventListener('click', () => {
        modal.style.display = 'none';
      });
      
      modalConfirm.addEventListener('click', () => {
        if (!modalAccept.checked) return;
        const contractType = modalTitle.textContent.includes('KVKK') ? 'kvkk' : 
                           modalTitle.textContent.includes('Şartlar') ? 'terms' : 'disclosure';
        const checkbox = this.querySelector(`input[name="${contractType}_consent"]`);
        if (checkbox) {
          checkbox.checked = true;
        }
        modal.style.display = 'none';
      });
      
      // Add hover effects to buttons
      const closeBtn = modalClose;
      const confirmBtn = modalConfirm;
      if (closeBtn) {
        closeBtn.addEventListener('mouseenter', () => {
          closeBtn.style.background = '#475569';
          closeBtn.style.transform = 'translateY(-1px)';
        });
        closeBtn.addEventListener('mouseleave', () => {
          closeBtn.style.background = '#64748b';
          closeBtn.style.transform = 'translateY(0)';
        });
      }
      if (confirmBtn) {
        confirmBtn.addEventListener('mouseenter', () => {
          if (!confirmBtn.disabled) {
            confirmBtn.style.background = '#008a73';
            confirmBtn.style.transform = 'translateY(-1px)';
          }
        });
        confirmBtn.addEventListener('mouseleave', () => {
          if (!confirmBtn.disabled) {
            confirmBtn.style.background = '#00a389';
            confirmBtn.style.transform = 'translateY(0)';
          }
        });
      }
      
      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }

    validateForm(form) {
      const errorNode = this.querySelector("[data-role='error']");
      if (errorNode) errorNode.textContent = "";
      
      const formData = new FormData(form);
      
      // Validate full name
      const fullName = formData.get("full_name")?.toString().trim() || "";
      if (fullName.length < 2) {
        this.showError(this.t("required") + ": " + this.t("fullName"));
        return false;
      }
      
      // Validate id_type selection
      const idType = formData.get("id_type")?.toString().trim() || "";
      if (!idType) {
        this.showError(this.t("required") + ": " + this.t("idType"));
        return false;
      }
      
      // Validate TCKN if TC is selected
      if (idType === 'tc') {
        const tcIdentity = formData.get("tc_identity_number")?.toString().trim() || "";
        if (!tcIdentity || tcIdentity.length !== 11 || !/^\d{11}$/.test(tcIdentity)) {
          this.showError(this.t("invalidTCKN"));
          return false;
        }
      }
      
      // Validate Passport if Passport is selected
      if (idType === 'passport') {
        const passportNumber = formData.get("passport_number")?.toString().trim() || "";
        if (!passportNumber || passportNumber.length < 3) {
          this.showError(this.t("required") + ": " + this.t("passportNumber"));
          return false;
        }
      }
      
      // Validate phone
      const phone = formData.get("phone_number")?.toString().trim() || "";
      const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
      if (!phone || cleanPhone.length < 10 || !/^\d+$/.test(cleanPhone)) {
        this.showError(this.t("invalidPhone"));
        return false;
      }
      
      // Validate email
      const email = formData.get("email")?.toString().trim() || "";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        this.showError(this.t("invalidEmail"));
        return false;
      }
      
      // Validate datetime fields (prefer datetime-local, fall back to date)
      const startDateTime = formData.get("start_datetime");
      const endDateTime = formData.get("end_datetime");
      const checkinDate = formData.get("checkin_date");
      const checkoutDate = formData.get("checkout_date");
      
      let startDt, endDt;
      if (startDateTime && endDateTime) {
        startDt = new Date(startDateTime);
        endDt = new Date(endDateTime);
      } else if (checkinDate && checkoutDate) {
        // Legacy date fields
        startDt = new Date(checkinDate);
        endDt = new Date(checkoutDate);
      } else {
        this.showError(this.t("required") + ": " + this.t("checkinDateTime") + ", " + this.t("checkoutDateTime"));
        return false;
      }
      
      const now = new Date();
      if (startDt < now) {
        this.showError(this.t("pastDate"));
        return false;
      }
      
      if (endDt <= startDt) {
        this.showError(this.t("checkoutBeforeCheckin"));
        return false;
      }
      
      // Validate minimum duration (at least 0.5 hours)
      const durationHours = (endDt - startDt) / (1000 * 60 * 60);
      if (durationHours < 0.5) {
        this.showError("Minimum süre 30 dakikadır");
        return false;
      }
      
      // Validate luggage count
      const luggageCount = Number(formData.get("luggage_count") || 0);
      if (luggageCount < 1) {
        this.showError(this.t("invalidLuggageCount"));
        return false;
      }
      
      // Validate consents
      const kvkkConsent = formData.get("kvkk_consent") === "on";
      const termsConsent = formData.get("terms_consent") === "on";
      const disclosureConsent = formData.get("disclosure_consent") === "on";
      
      if (!kvkkConsent) {
        this.showError(this.t("kvkkConsentRequired"));
        return false;
      }
      if (!termsConsent) {
        this.showError(this.t("consentRequired"));
        return false;
      }
      if (!disclosureConsent) {
        this.showError(this.t("disclosureConsentRequired"));
        return false;
      }
      
      return true;
    }
    
    showError(message) {
      const errorNode = this.querySelector("[data-role='error']");
      if (errorNode) {
        errorNode.textContent = message;
        errorNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    async submitForm(formData) {
      const errorNode = this.querySelector("[data-role='error']");
      if (errorNode) errorNode.textContent = "";
      
      // Get form values
      const fullName = formData.get("full_name")?.toString().trim() || "";
      const idType = formData.get("id_type")?.toString().trim() || "";
      const tcIdentityRaw = formData.get("tc_identity_number")?.toString().trim() || "";
      const tcIdentity = (idType === 'tc' && tcIdentityRaw.length > 0) ? tcIdentityRaw : null;
      const passportNumberRaw = formData.get("passport_number")?.toString().trim() || "";
      const passportNumber = (idType === 'passport' && passportNumberRaw.length > 0) ? passportNumberRaw : null;
      const phoneNumber = formData.get("phone_number")?.toString().trim() || "";
      const email = formData.get("email")?.toString().trim() || "";
      const hotelRoomNumber = formData.get("hotel_room_number")?.toString().trim() || null;
      const startDateTime = formData.get("start_datetime");
      const endDateTime = formData.get("end_datetime");
      const checkinDate = formData.get("checkin_date");  // Legacy
      const checkoutDate = formData.get("checkout_date");  // Legacy
      const luggageCount = Number(formData.get("luggage_count") || 1);
      const luggageType = formData.get("luggage_type")?.toString().trim() || null;
      const luggageDescription = formData.get("luggage_description")?.toString().trim() || null;
      const notes = formData.get("notes")?.toString().trim() || null;
      const kvkkConsent = formData.get("kvkk_consent") === "on";
      const termsConsent = formData.get("terms_consent") === "on";
      const disclosureConsent = formData.get("disclosure_consent") === "on";
      
      // Convert datetime-local to ISO string for backend
      let startDtISO = null;
      let endDtISO = null;
      if (startDateTime && endDateTime && startDateTime.trim() && endDateTime.trim()) {
        try {
          // datetime-local input gives us a value like "2024-01-01T12:00" (local time)
          // Create Date object and convert to ISO string (UTC)
          const startDt = new Date(startDateTime);
          const endDt = new Date(endDateTime);
          if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
            startDtISO = startDt.toISOString();
            endDtISO = endDt.toISOString();
          }
        } catch (e) {
          console.error("Error parsing datetime:", e);
          this.showError("Geçersiz tarih/saat formatı");
          return;
        }
      } else if (checkinDate && checkoutDate && checkinDate.trim() && checkoutDate.trim()) {
        try {
          // Legacy: convert date to datetime (start of day for checkin, end of day for checkout)
          const checkin = new Date(checkinDate);
          checkin.setHours(0, 0, 0, 0);
          const checkout = new Date(checkoutDate);
          checkout.setHours(23, 59, 59, 999);
          if (!isNaN(checkin.getTime()) && !isNaN(checkout.getTime())) {
            startDtISO = checkin.toISOString();
            endDtISO = checkout.toISOString();
          }
        } catch (e) {
          console.error("Error parsing date:", e);
          this.showError("Geçersiz tarih formatı");
          return;
        }
      }
      
      if (!startDtISO || !endDtISO) {
        this.showError(this.t("required") + ": " + this.t("checkinDateTime") + ", " + this.t("checkoutDateTime"));
        return;
      }
      
      const payload = {
        ...(checkinDate ? { checkin_date: checkinDate } : {}),  // Legacy backward compatibility
        ...(checkoutDate ? { checkout_date: checkoutDate } : {}),  // Legacy backward compatibility
        start_datetime: startDtISO,
        end_datetime: endDtISO,
        luggage_count: luggageCount,
        baggage_count: luggageCount, // Backward compatibility
        ...(luggageType ? { luggage_type: luggageType } : {}),
        ...(luggageDescription ? { luggage_description: luggageDescription } : {}),
        ...(hotelRoomNumber ? { hotel_room_number: hotelRoomNumber } : {}),
        ...(notes ? { notes: notes } : {}),
        kvkk_consent: kvkkConsent,
        kvkk_approved: kvkkConsent, // Backward compatibility
        terms_consent: termsConsent,
        disclosure_consent: disclosureConsent,
        ...(this.captchaToken ? { captcha_token: this.captchaToken } : {}),
        guest: {
          name: fullName,
          full_name: fullName,
          email: email,
          phone: phoneNumber,
          phone_number: phoneNumber,
          ...(tcIdentity ? { tc_identity_number: tcIdentity } : {}),
          ...(passportNumber ? { passport_number: passportNumber } : {}),
        },
        // Add payment provider for demo flow - default to "fake" for testing
        payment_provider: formData.get("payment_provider") || "fake",
      };
      
      // Store success data for confirmation screen
      this.state.successData = {
        fullName: fullName,
        luggageCount: luggageCount,
        checkInDate: startDateTime || checkinDate,
        checkOutDate: endDateTime || checkoutDate,
      };

      // Re-initialize if token is missing or expired
      if (!this.accessToken) {
        await this.initialize();
      }

      // Log payload for debugging
      console.log("=== SUBMITTING RESERVATION ===");
      console.log("Payload:", JSON.stringify(payload, null, 2));
      console.log("API Base:", this.options.apiBase);
      console.log("Access Token:", this.accessToken ? "Present" : "Missing");
      
      try {
        const url = new URL("/public/widget/reservations", this.options.apiBase).toString();
        console.log("Request URL:", url);
        
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.accessToken}`,
            Origin: window.location.origin,
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        
        console.log("Response status:", response.status, response.statusText);
        console.log("Response headers:", Object.fromEntries(response.headers.entries()));
        if (!response.ok) {
          let body = {};
          let errorText = "";
          try {
            // Clone response to read it multiple times if needed
            const responseClone = response.clone();
            errorText = await response.text();
            console.error("=== RESERVATION ERROR ===");
            console.error("Status:", response.status, response.statusText);
            console.error("Raw error response text:", errorText);
            
            try {
              body = JSON.parse(errorText);
              console.error("Parsed error body:", body);
            } catch (parseError) {
              console.error("Error parsing JSON:", parseError);
              body = { detail: errorText || response.statusText };
            }
          } catch (e) {
            console.error("Error reading response:", e);
            body = { detail: errorText || response.statusText || "Unknown error" };
          }
          
          // Extract error message from various possible formats
          let errorMessage = null;
          if (typeof body.detail === 'string') {
            errorMessage = body.detail;
          } else if (typeof body.detail === 'object' && body.detail) {
            errorMessage = body.detail.message || body.detail.detail || JSON.stringify(body.detail);
          } else if (body.message) {
            errorMessage = body.message;
          } else if (body.error) {
            errorMessage = body.error;
          } else {
            errorMessage = `${response.status} ${response.statusText}`;
          }
          
          console.error("Final error message:", errorMessage);
          console.error("Full error body:", JSON.stringify(body, null, 2));
          console.error("========================");
          
          const errorMsg = typeof errorMessage === 'string' ? errorMessage : this.t("error");
          if (errorNode) {
            errorNode.textContent = errorMsg;
            errorNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          throw new Error(errorMsg);
        }
        const data = await response.json();
        this.state.successRef = data.id;
        this.render();
        
        // Dispatch custom event for demo flow integration
        this.dispatchEvent(new CustomEvent("kyradi-reservation-success", {
          detail: {
            id: data.id,
            payment_intent_id: data.payment_intent_id,
            payment_required: data.payment_required,
            payment_url: data.payment_url,
            status: data.status,
            // Include datetime fields for storage selection
            start_datetime: startDtISO,
            end_datetime: endDtISO,
            checkin_date: checkinDate || (startDtISO ? new Date(startDtISO).toISOString().split('T')[0] : null), // Legacy compatibility
            checkout_date: checkoutDate || (endDtISO ? new Date(endDtISO).toISOString().split('T')[0] : null), // Legacy compatibility
          },
          bubbles: true,
        }));
      } catch (error) {
        console.error("=== CATCH BLOCK ERROR ===");
        console.error("Error object:", error);
        console.error("Error message:", error?.message);
        console.error("Error stack:", error?.stack);
        console.error("========================");
        if (errorNode) {
          const errorMsg = error instanceof Error ? error.message : (typeof error === 'string' ? error : this.t("error"));
          errorNode.textContent = errorMsg;
          errorNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          console.error("Error node not found!");
        }
      }
    }
  }

  function loadHCaptcha() {
    return new Promise((resolve) => {
      if (window.hcaptcha) {
        resolve(window.hcaptcha);
        return;
      }
      const existing = document.getElementById("hcaptcha-script");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.hcaptcha));
        return;
      }
      const scriptTag = document.createElement("script");
      scriptTag.id = "hcaptcha-script";
      scriptTag.src = "https://js.hcaptcha.com/1/api.js?onload=_kyradiCaptchaLoaded&render=explicit";
      window._kyradiCaptchaLoaded = () => resolve(window.hcaptcha);
      document.head.appendChild(scriptTag);
    });
  }

  window.KyradiReserve = {
    config: globalOptions,
    mount() {
      if (!customElements.get("kyradi-reserve")) {
        customElements.define("kyradi-reserve", KyradiReserveElement);
      }
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.KyradiReserve.mount());
  } else {
    window.KyradiReserve.mount();
  }
})();
