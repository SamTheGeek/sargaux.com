/**
 * Centralised copy for all user-visible text on the site.
 *
 * Every string has an English ('en') and French ('fr') variant.
 *
 * IMPORTANT: French copy has been reviewed by a native French speaker
 * (see French_Location_Implementation_NY.md, June 2026). Do not regenerate,
 * "fix", or revert any French string to a model-derived/machine translation.
 * Only change French text in response to an explicit, human-provided update.
 *
 * Usage in Astro pages:
 *   import { strings } from '../../content/strings';
 *   import { createTranslator } from '../../lib/i18n';
 *   const t = createTranslator(Astro.locals.lang ?? 'en');
 *   <h1>{t(strings.nyc.heroTitle)}</h1>
 */

export type Lang = 'en' | 'fr';

/** Bilingual string pair */
interface T {
  en: string;
  fr: string;
}

/** Shorthand to create a bilingual string pair */
function s(en: string, fr: string): T {
  return { en, fr };
}

/**
 * English-only content. Used for sections that only render on the English site
 * (e.g. the France Travel page's ETIAS, International Driving Permit, and
 * Practical Information sections, which the French page intentionally omits).
 * The French slot mirrors the English so the type is satisfied but is never shown.
 */
function en(str: string): T {
  return { en: str, fr: str };
}

/** RSVP deadline dates — single source of truth for each event */
export const RSVP_DEADLINE_NYC    = { en: 'September 1, 2026',  fr: '1er septembre 2026' } satisfies T;
export const RSVP_DEADLINE_FRANCE = { en: 'April 1, 2027',      fr: '1er avril 2027'     } satisfies T;
export const NYC_EVENT_TIME       = { en: '5:30 PM — 9 PM',     fr: '17 h 30 à 21 h'     } satisfies T;

export const strings = {
  // ─────────────────────────────────────────
  // Global — shared across all pages
  // ─────────────────────────────────────────
  global: {
    siteName:     s('Chez Sargaux', 'Chez Sargaux'),
    rsvpBtn:      s('RSVP', 'RSVP'),
    registry:     s('Registry', 'Liste de mariage'),
    logout:       s('Logout', 'Se déconnecter'),
    explore:      s('Explore', 'Explorer'),
    copyright:    s('© 2026 Sam Gross', '© 2026 Sam Gross'),
    detailsToCome: s('Details to come', 'Détails à venir'),
    attending:    s('Attending', 'Présent'),
    notAttending: s('Not attending', 'Absent'),
    // Event dropdown options + decline button — French provided by Sam (2026-07-18)
    eventAttendingOption:    s('Attending', 'Oui'),
    eventNotAttendingOption: s('Not attending', 'Non'),
    regretfullyDecline:      s('Regretfully Decline', 'Décline avec regret'),
    // French provided by Sam (2026-07-18) — provisional, may be revised
    eventSelectionRequired:  s("Please let us know if you'll be joining us for this event.", 'Merci de choisir votre réponse'),
    // French provided by Sam (2026-07-04) — do not machine-translate
    savingBtn:    s('Saving', 'Enregistrement'),
    toggle: {
      nyc:    s('NYC', 'NYC'),
      france: s('France', 'France'),
    },
  },

  // ─────────────────────────────────────────
  // Navigation — back links etc.
  // ─────────────────────────────────────────
  nav: {
    backToEvent:  s('← Return to event', '← Retour à l\'événement'),
    home:         s('Home', 'Accueil'),
  },

  // ─────────────────────────────────────────
  // Homepage
  // ─────────────────────────────────────────
  home: {
    pageTitle:  s('Homepage', 'Accueil'),
    heroTitle:  s('Chez Sargaux', 'Chez Sargaux'),
    tagline:    s('Sam & Margaux', 'Sam & Margaux'),
    ctaEnter:   s('Entrez', 'Entrez'),
    inline: {
      prompt: s('Please enter your name', 'Veuillez entrer votre nom'),
      note: s('As it appears on your invitation.', "Tel qu'il apparaît sur votre invitation."),
    },
    modal: {
      title:        s('Welcome', 'Bienvenue'),
      subtitle:     s('Please enter your name to continue', 'Veuillez entrer votre nom pour continuer'),
      nameLabel:    s('Your name', 'Votre nom'),
      namePlaceholder: s('Your name', 'Votre prénom et nom'),
      submitBtn:    s('Continuer', 'Continuer'),
      checkingBtn:  s('Checking', 'Vérification'),
      submitAriaLabel: s('Submit name', 'Envoyer le nom'),
      errorEmpty:   s('Please enter your name', 'Veuillez entrer votre nom'),
      errorDefault: s('Something went wrong. Please try again.', 'Une erreur est survenue. Veuillez réessayer.'),
    },
  },

  // ─────────────────────────────────────────
  // Shared couple page
  // ─────────────────────────────────────────
  couple: {
    pageTitle: s('The Couple', 'Le Couple'),
    eyebrow: s('Established May 2020', 'Established May 2020'),
    heroTitle: s('The Couple', 'Le Couple'),
    subtitle: s('Margaux Ancel &\nSam Gross', 'Margaux Ancel &\nSam Gross'),
    photoLabel: s('Photo One', 'Photo Un'),
    photoCaption: s('A first image from the archive.', "Une première image de l'archive."),
    navLabel: s('Event Pages', 'Pages événement'),
    story: {
      intro: s(
        "Margaux & Sam's story started through Hinge in the early weeks of lockdown. After a few pandemic-tinged dates (a synced viewing of Casablanca, long walks around Brooklyn with to-go cocktails from local bars, and many picnics in Brooklyn Bridge Park to watch the sun set over Manhattan), they knew they had found their perfect match.",
        "L'histoire de Margaux et Sam a commencé sur Hinge au début du confinement, en mai 2020.\n\nAprès quelques rendez-vous un peu particuliers, entre une séance de Casablanca synchronisée à distance, de longues promenades dans Brooklyn avec des cocktails à emporter et des pique-niques au Brooklyn Bridge Park face au coucher du soleil sur Manhattan, ils ont rapidement compris qu'ils avaient trouvé leur évidence.",
      ),
      passions: s(
        "They discovered a shared passion for travel (and bonded over their nearly-identical trips to Japan just before they met), collecting city magnets, modern art and architecture, French electro house music, and snacks. Over the past 6.5 years, they have also picked up each other's hobbies: following Margaux's love for cooking, Sam has become an excellent chef, and while she won't be doing the Tour de France anytime soon, Margaux now joins Sam on long bike rides for great snack destinations. Together, they have explored 11 countries across North America, South America and Europe, most notably the Netherlands, where Sam proposed to Margaux over a 3-day date in Amsterdam.",
        "Ils ont découvert qu'ils partageaient de nombreuses passions communes, notamment les voyages (dont témoigne leur collection d'aimants sur le réfrigérateur, rapportés de leurs aventures autour du monde), l'art et l'architecture contemporains, la musique électro française et Star Wars. Au cours des six dernières années, ils ont également adopté les centres d'intérêt l'un de l'autre. Sam est devenu un excellent cuisinier, tandis que Margaux accompagne désormais volontiers Sam dans ses longues sorties à vélo, à condition qu'une bonne adresse gourmande les attende à l'arrivée.\n\nEnsemble, ils ont exploré onze pays à travers les Amériques du Nord et du Sud ainsi que l'Europe. Parmi leurs voyages les plus marquants figure Amsterdam, où Sam a demandé Margaux en mariage.",
      ),
      samBackground: s(
        'Sam was born and raised in the suburbs of Washington, D.C., before attending the University of Maryland. He became a forever New Yorker in 2015.',
        'Sam a grandi dans la région de Washington, D.C., avant de s\'installer à New York en 2015.',
      ),
      margauxBackground: s(
        'Margaux was born in France and lived in the suburbs of Paris until moving to Connecticut in 2008 with her parents and two sisters. She spent her freshman year at Concordia University in Montréal living with her older sister, before transferring to the University of Connecticut for the remainder of her undergraduate and graduate studies. She became a forever New Yorker in 2019.',
        'Née en France, Margaux a grandi près de Paris avant de s\'installer dans le Connecticut avec sa famille en 2008. Après quelques années passées entre Montréal et le Connecticut pour ses études, elle a rejoint New York en 2019.',
      ),
      closing: s(
        'We are so excited to celebrate this next chapter in our lives with you, thank you for being a part of it!',
        'Nous sommes impatients de célébrer ce nouveau chapitre de notre vie avec vous et vous remercions d\'en faire partie.',
      ),
    },
  },

  // ─────────────────────────────────────────
  // NYC — all NYC pages
  // ─────────────────────────────────────────
  nyc: {
    // Landing page
    pageTitle:       s('NYC Event', 'Événement New York'),
    heroTitle:       s('New York', 'New York'),
    heroDate:        s('October 11, 2026', '11 octobre 2026'),
    heroDateTentative: s('', ''),
    heroEventType:   s('Dinner & Dancing', 'Dîner & Dancing'),
    timeRange:       NYC_EVENT_TIME,
    when: {
      heading:  s('When', 'Quand'),
      date:     s('Sunday, October 11, 2026', 'Dimanche 11 octobre 2026'),
      time:     NYC_EVENT_TIME,
      weekend:  s('', ''),
      note:     s('', ''),
    },
    where: {
      heading:       s('Where', 'Où'),
      dinner:        s('Bar Blondeau', 'Bar Blondeau'),
      dinnerAddress: s('Wythe Hotel, 6th Floor · 80 Wythe Avenue · Brooklyn, New York', 'Wythe Hotel, 6e étage · 80 Wythe Avenue · Brooklyn, New York'),
      dinnerType:    s('Cocktails & Dinner', 'Cocktail & Dîner'),
      separator:     s('followed by', ''),
      dancing:       s('Dancing (Location TBA)', 'Suivis d’une soirée dansante dans Williamsburg.'),
    },
    dressCode: {
      heading: s('Dress Code', 'Tenue'),
      value:   s('Festive Cocktail Attire', 'Tenue de cocktail'),
      note:    s('Think jackets but no tie required.', 'Veste recommandée, cravate non obligatoire.'),
    },
    rsvpDeadline: {
      heading: s('RSVP', 'RSVP'),
      value:   { en: `By ${RSVP_DEADLINE_NYC.en}`, fr: `Merci de répondre avant le ${RSVP_DEADLINE_NYC.fr}.` },
    },
    calendar: {
      heading:         s('Save the Date', 'Notez la date'),
      subtext:         s("Add the events to your calendar app.", "Ajoutez notre événement à votre agenda pour ne rien manquer."),
      addBtn:          s('Add to Calendar', "Ajouter à mon agenda"),
      unavailableNote: s('Your calendar will be available after you RSVP.', 'Votre calendrier sera disponible après votre RSVP.'),
    },
    nav: {
      details: {
        title: s('Details', 'Détails'),
        desc:  s('Venues & what to expect', 'Lieu & Soirée'),
      },
      faq: {
        title: s('FAQ', 'FAQ'),
        desc:  s('Questions & answers', 'Questions fréquentes'),
      },
      couple: {
        title: s('The Couple', 'Le Couple'),
        desc:  s('Read our story', 'Notre histoire'),
      },
      travel: {
        title: s('Travel', 'Informations pratiques'),
        desc:  s('Hotels & getting around', 'Hébergement, transports & conseils'),
      },
      lookbook: {
        title: s('Lookbook', 'Lookbook'),
        desc:  s('Outfit inspiration & ideas', 'Inspiration tenues'),
      },
      registry: {
        title: s('Registry', 'Liste de mariage'),
        // TODO(sam/margaux): French copy needed — English placeholder
        desc:  s('Gifts, funds & wishes', 'Gifts, funds & wishes'),
      },
      rsvp: {
        title: s('RSVP', 'RSVP'),
        desc:  s("Let us know you're coming", 'Confirmer votre présence'),
      },
    },
    optional: {
      heading:     s('More to Explore', 'Plus à découvrir'),
      placeholder: s('Optional events throughout the weekend will be listed here once confirmed.', 'Les événements optionnels du week-end seront listés ici une fois confirmés.'),
    },

    // /nyc/details
    details: {
      pageTitle:  s('NYC Details', 'Détails New York'),
      heroTitle:  s('The Party', 'La Célébration'),
      subtitle:   s('October 11, 2026', '11 octobre 2026'),
      schedule: {
        heading: s('Schedule', 'Déroulé de la soirée'),
        dinner: {
          time:  s('5:30 PM', '17 h 30'),
          title: s('Cocktails & Bites', 'Début de la Soirée'),
          desc:  s("Cocktails, passed hors d'oeuvres, and small plates", 'Apéro Dinatoire'),
        },
        sunsetTime: s('6:23 PM', '18 h 23'),
        sunset: s('Sunset behind the Manhattan skyline', 'Coucher du soleil sur Manhattan'),
        dancing: {
          time:  s('9:30 PM', '21 h 30'),
          title: s('After Party - Dancing', 'Soirée Dansante'),
          desc:  s(
            'Join us as we head to a nearby venue and keep the night going. No reservations, just dancing and continued celebration.',
            'La soirée continue à quelques pas du Bar Blondeau. Rejoignez-nous pour danser !',
          ),
        },
      },
      venues: {
        heading: s('The Venues', 'Les Lieux'),
        getDirections: s('Get Directions →', 'Itinéraire →'),
        dinner: {
          title:          s('Celebration', 'Célébration'),
          name:           s('Bar Blondeau at the Wythe Hotel', 'Bar Blondeau au Wythe Hotel'),
          address:        s('80 Wythe Avenue · Brooklyn, New York', '80 Wythe Avenue · Brooklyn, New York'),
          mapPlaceholder: s('Map will be added here', 'La carte sera ajoutée ici'),
        },
        dancing: {
          title:          s('After Party - Dancing', 'Soirée Dansante'),
          name:           s('Location TBA', 'Williamsburg, Brooklyn'),
          mapPlaceholder: s('Map will be added here', 'La carte sera ajoutée ici'),
        },
      },
      lookbookLink: s('View the lookbook →', 'Voir le lookbook →'),
      whatToExpect: {
        heading: s('What to Expect', 'Programme'),
        text:    s(
          "Join us for an evening of cocktails and bites to share, with a stunning view of the sunset over the New York City skyline.\n\nThis evening is our chance to celebrate with you in New York, and we're so happy to share it with you.",
          "Rejoignez-nous pour une soirée de cocktails et de bouchées à partager, avec une vue imprenable sur le coucher du soleil et les toits de New York.\n\nCette soirée est l’occasion de célébrer ce nouveau chapitre de vie, et nous sommes ravis de partager ce moment avec vous à New York.",
        ),
      },
      dressCode: {
        heading: s('Dress Code', 'Tenue'),
        value:   s('Festive Cocktail Attire', 'Tenue de cocktail'),
        note:    s('Think jackets, but no tie required.', 'Veste recommandée, cravate non obligatoire.'),
      },
      calendar: {
        heading: s('Add to Calendar', "Ajouter à mon agenda"),
        btn:     s('Subscribe to Calendar', "S'abonner au calendrier"),
        note:    s('Personalized calendar link based on your RSVP', 'Calendrier personnalisé selon vos réponses'),
      },
    },

    // /nyc/travel
    travel: {
      pageTitle: s('NYC Travel', 'Voyager à New York'),
      heading:   s('Travel', 'Info pratiques'),
      subtitle:  s('Getting to and around NYC', "Se rendre et se déplacer à New York"),
      hotels: {
        heading:    s('Hotels', 'Hôtels'),
        intro:      s('Suggested accommodations near the venues:', 'Hébergements suggérés à proximité des lieux :'),
        hotel1:     s('The hotel that hosts our venue at', "L'hôtel où se déroule notre célébration, au"),
        hotel1BookNow: s('Book now →', 'Réserver →'),
        hotel2:     s('Just down the street from the Wythe at', 'À quelques pas du Wythe Hotel, au'),
        hotel2BookNow: s('Book now →', 'Réserver →'),
        hotel3:     s("Located in Manhattan's NoMad neighborhood at", "Situé dans le quartier de NoMad, à Manhattan, au"),
        hotel3BookNow: s('Book now →', 'Réserver →'),
      },
      gettingThere: {
        heading: s('Getting There', 'Comment arriver'),
        air: {
          heading: s('By Air', 'En avion'),
          jfk:     s('JFK — AirTrain + subway, ~60-75 min to Manhattan', "JFK — AirTrain + métro, ~60-75 min jusqu'à Manhattan"),
          lga:     s('LGA — Taxi/rideshare or Q70 bus + subway, ~30-45 min', 'LGA — Taxi/VTC ou bus Q70 + métro, ~30-45 min'),
          ewr:     s('EWR — AirTrain + NJ Transit to Penn Station, ~45-60 min', "EWR — AirTrain + NJ Transit jusqu'à Penn Station, ~45-60 min"),
        },
        train: {
          heading: s('By Train', 'En train'),
          text:    s('Amtrak arrives at Penn Station.', 'Amtrak arrive à Penn Station.'),
        },
        bus: {
          heading:  s('By Bus', 'En bus'),
          intro:    s('Multiple bus services arrive near Penn Station:', 'Plusieurs services de bus arrivent au Port Authority Bus Terminal (42e rue) :'),
          vamoose:   s('Vamoose — Direct service from DC and Northern Virginia', 'Vamoose — Service direct depuis DC et la Virginie du Nord'),
          tripper:   s('Tripper — Service from Washington DC', 'Tripper — Service depuis Washington DC'),
        },
      },
      gettingAround: {
        heading: s('Getting Around', 'Se déplacer'),
        subway: {
          heading:        s('By Subway', 'En métro'),
          intro:          s('Take the L train to Bedford Avenue — a 5-minute walk to the venue.', "Prenez la ligne L jusqu'à Bedford Avenue, puis comptez environ cinq minutes de marche jusqu'au Bar Blondeau."),
          fareBeforeLink: s('Single ride: $3 (set up ', 'Trajet simple : $3. Le moyen le plus simple et rapide de payer le métro à New York est d\'utiliser le système '),
          fareLinkText:   s('Express Transit', 'sans contact OMNY'),
          fareAfterLink:  s(' on your phone ahead of time)', ". Vous n'avez plus besoin d'acheter de ticket à l'avance ; passez simplement votre carte bancaire sans contact ou votre téléphone/montre (Apple Pay, Google Pay) directement sur le tourniquet."),
          maps:           s('Apple Maps and Google Maps have great subway directions', "Apple Plans et Google Maps proposent d'excellents itinéraires en transports en commun."),
        },
        bike: {
          heading: s('By Bike', 'À vélo'),
          text:    s('A Citi Bike station is located just steps from the Wythe Hotel.', "Une station Citi Bike se trouve à quelques pas du Wythe Hotel."),
        },
        car: {
          heading: s('By Car', 'En voiture'),
          text:    s('Parking is available one block away at 25 Kent parking garage.', "Un parking est disponible au coin de la rue, au 25 Kent Avenue."),
        },
      },
      whileHere: {
        heading: s("While You're Here", 'Nos recommandations'),
        upperEastSide: {
          heading:    s('Museum Mile & Central Park', 'Museum Mile et Central Park'),
          body:       s("Start with a visit to the newly renovated Frick Collection — reserve tickets in advance, and if you're lucky, snag a lunch reservation in the dining room. Afterward, take a leisurely walk through Central Park. For drinks, head to Bemelmans Bar in The Carlyle for one of the most iconic bar experiences in the city.", "Commencez par visiter la Frick Collection, récemment rénovée. Réservez vos billets à l'avance et, avec un peu de chance, obtenez une réservation pour déjeuner dans la salle à manger. Ensuite, profitez d'une promenade dans Central Park. Pour prendre un verre, rendez-vous au Bemelmans Bar du Carlyle, l'un des bars les plus emblématiques de New York."),
          alsoInArea: s('Also in the area: The Met, MoMA, the Jewish Museum (free on shabbos!), the American Museum of Natural History, and the Guggenheim.', 'Également dans le quartier : le Met, le MoMA, le Jewish Museum (gratuit le shabbat !), l\'American Museum of Natural History et le Guggenheim.'),
        },
        prospectHeights: {
          heading: s('Follow in Our Footsteps', 'Notre New York'),
          body:    s("This is our neighborhood, and we love it. Start your morning with a visit to the Brooklyn Botanic Garden or take a stroll (or bike ride) through Prospect Park. Wander down Vanderbilt Avenue for Unnameable Books, A.Mano decor, great people-watching, and continue our eternal debate between Van Leeuwen and Ample Hills ice cream. For food, brave the line at Radio Bakery for excellent pastries and focaccia, try brunch at Gertie or Cafe Mado, or grab a sandwich at Prospect Heights Butcher or Ciao Gloria and eat outside on the pedestrianized street. For dinner, some of our favorites: Leland, Nuaa Table, Alta Calidad, and Zaytoons.", "C'est notre quartier, et nous l'adorons. Commencez la matinée par le Brooklyn Botanic Garden ou une promenade, voire une balade à vélo, dans Prospect Park. Promenez-vous sur Vanderbilt Avenue pour découvrir Unnameable Books, A.Mano Decor, observer les passants et poursuivre notre débat éternel entre les glaces Van Leeuwen et Ample Hills. Côté repas, affrontez la file de Radio Bakery pour d'excellentes pâtisseries et une focaccia, essayez le brunch chez Gertie ou Cafe Mado, ou prenez un sandwich chez Prospect Heights Butcher ou Ciao Gloria pour le manger dehors dans la rue piétonne. Pour le dîner, quelques-unes de nos adresses préférées : Leland, Nuaa Table, Alta Calidad et Zaytoons."),
        },
        dumbo: {
          heading: s('Where It All Began', 'Là où tout a commencé'),
          body:    s("A beautiful neighborhood where we kindled our relationship. Stroll through Brooklyn Bridge Park and up the bridge into Brooklyn Heights for some of the best views of the Manhattan skyline you'll find anywhere. We highly recommend making the trip by NYC Ferry — it runs from multiple points across Manhattan and Brooklyn, and the ride itself is half the fun. Check out the adaptive reuse of the Brooklyn docks abounding with quiet corners, play spaces, and sports facilities.", "Un très beau quartier où notre histoire a commencé. Promenez-vous dans Brooklyn Bridge Park puis montez jusqu'à Brooklyn Heights pour profiter de quelques-unes des plus belles vues sur la skyline de Manhattan. Nous vous recommandons vivement d'y aller en ferry : il dessert plusieurs embarcadères à Manhattan et à Brooklyn, et le trajet fait déjà la moitié du plaisir. Découvrez aussi la réinvention des anciens docks de Brooklyn, pleins de coins tranquilles, d'espaces de jeux et d'installations sportives."),
        },
        cycling: {
          heading:        s('Sunday Morning Ride', 'Dimanche matin à Brooklyn'),
          body:           s('Cycling together is something Sam & Margaux often do together around the city. A quick loop of Prospect Park is a great way to get outdoors and enjoy Brooklyn. CitiBikes are plentiful, and rental shops abound when the weather is nice. For the more adventurous, October is also peak leaf-peeping season. You can follow Sam\'s typical', 'Le vélo est une activité que Sam & Margaux pratiquent souvent ensemble en ville. Un tour de Prospect Park est une excellente façon de profiter de Brooklyn. Les Citi Bikes sont nombreux et disponibles partout à New York. Vous pouvez facilement en louer un avec l\'application Lyft. Pour les plus aventureux, octobre est aussi la pleine saison des feuillages. Vous pouvez suivre la'),
          linkText:       s('Sunday morning ride', 'sortie dominicale de Sam'),
          bodyAfter:      s('to New Jersey.', 'jusqu\'au New Jersey.'),
        },
      },
    },

    // /nyc/faq
    faq: {
      pageTitle: s('NYC FAQ', 'FAQ New York'),
      heading:   s('FAQ', 'FAQ'),
      subtitle:  s('Questions & answers for the weekend', 'Questions fréquentes'),
      moreQuestions: s('More questions? Email us at', 'Une question ? Écrivez-nous à'),
      links: {
        lookbook: s('See the lookbook →', 'Voir le Lookbook →'),
        travel:   s('Travel Page', 'page Informations pratiques'),
        travelPrefix: s('See the', 'Consultez la'),
        travelSuffix: s('for details and booking links.', 'pour les détails et les liens de réservation.'),
        registry: s('Visit the registry.', 'Voir la liste de mariage.'),
      },
      items: {
        dressCode: {
          question: s('What is the dress code?', 'Quel est le code vestimentaire ?'),
          answer:   s(
            'Festive cocktail attire!',
            'Tenue de cocktail festive !',
          ),
        },
        rsvpDeadline: {
          question: s('When is the RSVP deadline?', 'Quelle est la date limite pour répondre ?'),
          answer:   s(
            'Please RSVP by September 1, 2026.',
            'Merci de répondre avant le 1er septembre 2026.',
          ),
        },
        venue: {
          question: s('Where is the venue?', 'Où se trouve le lieu ?'),
          answer:   s(
            'The celebration is held at Bar Blondeau, located on the 6th floor of the Wythe Hotel in Williamsburg, Brooklyn. The bar is accessible through the hotel lobby and by elevator. The space has both indoor and outdoor areas, with seating available including banquettes and outdoor benches, though most of the evening will be a standing cocktail party. We recommend comfortable shoes!',
            "La célébration aura lieu au Bar Blondeau, situé au 6e étage du Wythe Hotel, à Williamsburg, Brooklyn. Le bar est accessible par le hall de l'hôtel et par ascenseur. Vous aurez accès à des espaces intérieurs et extérieurs, avec des banquettes à disposition. La majeure partie de la soirée se déroulera toutefois debout. Nous vous recommandons donc de porter des chaussures confortables !",
          ),
        },
        parking: {
          question: s('Is there parking nearby?', 'Y a-t-il un parking à proximité ?'),
          answer:   s(
            'There is a parking garage at 25 Kent Avenue. You can also reserve a spot at the Propark – William Vale Hotel via ParkMobile (parkmobile.io/reservation/57104).',
            'Un parking est disponible au 25 Kent Avenue. Vous pouvez également réserver une place au Propark du William Vale Hotel via ParkMobile (parkmobile.io/reservation/57104).',
          ),
        },
        weather: {
          question: s('What will the weather be like?', 'Quel temps fera-t-il ?'),
          answer:   s(
            'New York in October is beautiful. Expect mild autumn weather, typically in the 60s or even 70s during the day. Evenings can cool down to the 50s, so we recommend bringing a layer.',
            'En octobre, New York est magnifique. Les températures tournent généralement autour de 15 à 25 °C en journée et de 10 à 15 °C en soirée. Pensez simplement à prévoir une petite veste pour la fin de la soirée.',
          ),
        },
        foodDrinks: {
          question: s('What food and drinks will be served?', 'Quels plats et boissons seront servis ?'),
          answer:   s(
            "We'll have a full bar with wine, cocktails, and non-alcoholic options, along with passed hors d'oeuvres and small plates throughout the evening. The food will be pescatarian and vegetarian friendly, but will not come from a kosher kitchen. If you have a serious allergy, please let us know when you RSVP.",
            "Des cocktails, du vin et des boissons sans alcool seront proposés tout au long de la soirée, accompagnés de bouchées et de petites assiettes à partager. Des options végétariennes et pescétariennes seront disponibles. Le menu ne sera toutefois pas casher. Si vous souffrez d'une allergie alimentaire, merci de nous en informer au moment de votre RSVP.",
          ),
        },
        ceremony: {
          question: s('Will there be a ceremony or formal program?', 'Y aura-t-il une cérémonie ?'),
          answer:   s(
            'There will be no ceremony at this event. We will have a brief toast from the parents, but no formal program. This evening is for mingling and celebrating!',
            "Il n'y aura pas de cérémonie lors de cette soirée. Nous prévoyons simplement quelques mots de nos parents, puis la soirée sera consacrée aux retrouvailles et à la célébration.",
          ),
        },
        program: {
          question: s('Will there be speeches or a formal program?', 'Y aura-t-il des discours ?'),
          answer:   s(
            "We\'ll have speeches from our parents, but this evening is primarily about celebrating with you.",
            'Nos parents prendront brièvement la parole, mais la soirée sera avant tout consacrée aux retrouvailles et à la fête.',
          ),
        },
        children: {
          question: s('Are children invited?', 'Les enfants sont-ils invités ?'),
          answer:   s(
            'We love your little ones, but this is an adults-only celebration!',
            'Nous adorons vos petits, mais cette célébration sera réservée aux adultes !',
          ),
        },
        stay: {
          question: s('Where should out-of-town guests stay?', 'Où séjourner si je suis de passage à New York ?'),
          answer:   s(
            "We have a few room blocks available in Williamsburg and NoMad. If you need additional suggestions, don't hesitate to reach out!",
            "Nous avons négocié des tarifs préférentiels dans plusieurs hôtels à Williamsburg et NoMad. Si vous souhaitez d'autres recommandations, n'hésitez pas à nous contacter.",
          ),
        },
        registry: {
          question: s('Do you have a registry?', 'Avez-vous une liste de mariage ?'),
          answer:   s(
            "Your presence is truly gift enough, and we're so grateful you'll be there to celebrate with us. If you'd like to give something, contributions to our honeymoon fund are always welcome.",
            'Votre présence est le plus beau des cadeaux, et nous sommes très heureux de pouvoir célébrer avec vous. Si vous souhaitez nous faire plaisir, une contribution à notre voyage de noces sera toujours la bienvenue. Voir notre liste de mariage.',
          ),
        },
      },
    },

    // /nyc/lookbook
    lookbook: {
      pageTitle: s('NYC Lookbook', 'Lookbook New York'),
      heading:   s('Lookbook', 'Lookbook'),
      subtitle:  s('Outfit inspiration & ideas', 'Inspiration tenues & idées'),
    },

    // /nyc/rsvp
    rsvp: {
      pageTitle:         s('NYC RSVP', 'RSVP New York'),
      heading:           s('RSVP', 'RSVP'),
      subtitle:          s('New York · October 11, 2026', 'New York · 11 octobre 2026'),
      subtitleTentative: s('', ''),
      deadline:          s('Please respond by', 'Merci de répondre avant le'),
      deadlineDate:      RSVP_DEADLINE_NYC,
      unavailable: {
        heading: s('RSVP Unavailable', 'RSVP indisponible'),
        text:    s(
          'RSVP submissions require the Notion guest backend. Please log in again once that integration is enabled.',
          "Les RSVP nécessitent l'intégration Notion. Veuillez vous reconnecter une fois celle-ci activée.",
        ),
      },
      loadError: {
        heading: s('Unable to Load RSVP', 'Impossible de charger le RSVP'),
      },
      existingBanner: {
        prefix: s("You've already RSVP'd, but you can update it here until", "Vous avez déjà répondu, mais vous pouvez le modifier ici jusqu'au"),
      },
      confirmation: {
        pageTitle:    s('NYC RSVP Confirmation', 'Confirmation RSVP New York'),
        heading:      s('RSVP Saved', 'RSVP enregistré'),
        subtitle:     s('Here is your latest response for New York.', 'Voici votre dernière réponse pour New York.'),
        savedLabel:   s('Thank you! Your RSVP was last updated at', 'Merci ! Votre RSVP a été mis à jour pour la dernière fois à'),
        editLink:     s('Edit RSVP', 'Modifier le RSVP'),
        emptyValue:   s('Not provided', 'Non renseigné'),
        emailMissing: s('No email provided', "Aucune adresse email renseignée"),
        missing: {
          heading: s('No RSVP Found', 'Aucun RSVP trouvé'),
          text:    s('We could not find a saved NYC RSVP for your invitation yet.', "Nous n'avons pas encore trouvé de RSVP enregistré pour votre invitation New York."),
        },
      },
      form: {
        whosComing: {
          heading: s("Who's Coming?", 'Qui vient ?'),
          note:    s("Toggle each guest's attendance and edit names if needed.", 'Indiquez la présence de chaque invité et modifiez les noms si nécessaire.'),
        },
        coreEvents: {
          heading: s('Events', 'Événements'),
          note:    s('These events are part of your invitation.', 'Ces événements font partie de votre invitation.'),
          empty:   s('No core events are assigned to this invitation yet.', "Aucun événement principal n'est encore assigné à cette invitation."),
        },
        optionalEvents: {
          heading: s('Special Activities', 'Activités spéciales'),
          note:    s("Choose any extra celebrations you'd like to attend.", 'Choisissez les célébrations supplémentaires auxquelles vous souhaitez participer.'),
          empty:   s('No optional events are assigned right now.', "Aucun événement optionnel n'est assigné pour le moment."),
        },
        dietary: {
          heading:     s('Dietary Restrictions', 'Restrictions alimentaires'),
          note:        s('Let us know about allergies or dietary preferences.', 'Indiquez-nous vos allergies ou préférences alimentaires.'),
          placeholder: s('e.g., Vegetarian, nut allergy, gluten-free', 'ex. : Végétarien, allergie aux noix, sans gluten'),
        },
        message: {
          heading:     s('Message for Us', 'Message pour nous'),
          placeholder: s('Share your well wishes or anything else we should know', 'Partagez vos vœux ou tout ce que nous devrions savoir'),
        },
        email: {
          heading:          s('Confirmation Email', 'Confirmation par e-mail'),
          label:            s('Email address', 'Adresse email'),
          optional:         s('(optional)', '(facultatif)'),
          placeholder:      s('you@example.com', 'vous@exemple.com'),
          sendConfirmation: s('Send me an email confirmation', "M'envoyer une confirmation par e-mail"),
          note:             s('Everyone below with an email address will receive the confirmation.', 'Toutes les adresses e-mail renseignées ci-dessous recevront un e-mail de confirmation.'),
          requireOne:       s('At least one email address is required. We recommend adding an email address for everyone in your party.', 'Au moins une adresse email est requise. Nous recommandons de renseigner une adresse email pour chaque membre de votre groupe.'),
          requireAll:       s('An email address is required for each guest.', 'Une adresse email est requise pour chaque invité.'),
        },
        lastSubmittedLabel: s('Last submitted:', 'Dernière soumission :'),
        submitBtn:   s('Submit RSVP', 'Confirmer ma présence'),
        updateBtn:   s('Update RSVP', 'Mettre à jour mon RSVP'),
        successMsg:  s('RSVP submitted successfully.', 'RSVP envoyé avec succès.'),
        errorMsg:    s('We could not submit your RSVP. Please try again.', "Nous n'avons pas pu envoyer votre RSVP. Veuillez réessayer."),
        signedInAs:  s('Signed in as', 'Vous répondez en tant que'),
        canUpdate:   { en: 'You can update your response anytime before the deadline.', fr: `Vous pourrez modifier votre réponse à tout moment jusqu'au ${RSVP_DEADLINE_NYC.fr}.` },
      },
    },
  },

  // ─────────────────────────────────────────
  // France — all France pages
  // ─────────────────────────────────────────
  france: {
    // Landing page
    pageTitle:     s('France Event', 'Événement France'),
    heroLocation:  s('France', 'France'),
    heroTitle:     s('Village de\u00A0Sully', 'Village de\u00A0Sully'),
    heroDate:      s('28–30 May 2027', '28–30 mai 2027'),
    heroEventType: s('A Weekend Celebration', 'Un week-end de célébration'),
    heroTagline:   s('Margaux and Sam are getting married!', 'Margaux et Sam se marient !'),
    sections: {
      programme:         s('The Weekend', 'Le Week-end'),
      programmeSubtitle: s('All events will take place at the Village de Sully.', 'Tous les événements du week-end auront lieu au Village de Sully.'),
      details:           s('The Details', 'Infos pratiques'),
    },
    when: {
      heading: s('When', 'Quand'),
      dates:   s('Friday, May 28 – Sunday, May 30, 2027', 'Vendredi 28 mai – Dimanche 30 mai 2027'),
      desc:    s('Full weekend celebration', 'Week-end de célébration'),
    },
    where: {
      heading:       s('Where', 'Où'),
      venueLabel:    s('Venue', 'Où'),
      datesLabel:    s('Dates', 'Dates'),
      mapLabel:      s('Map', 'Carte'),
      venue:         s('Village de Sully', 'Village de Sully'),
      location:      s('Rosny-sur-Seine, France', 'Rosny-sur-Seine, France'),
      appleMapLink:  s('View on Apple Maps ↗', 'Voir sur Apple Maps ↗'),
      googleMapLink: s('View on Google Maps ↗', 'Voir sur Google Maps ↗'),
    },
    accommodation: {
      heading:       s('Stay', 'Hébergement'),
      stayAtVillage: s('Stay at Village de Sully', 'Dormir au Village de Sully'),
      desc:          s(
        'We encourage all guests to stay on site to enjoy the full wedding weekend and spend more time together. Accommodations include traditional Village Rooms and restored private train car suites, with options for couples, families, and larger groups.',
        "Nous vous encourageons à rester sur place afin de profiter pleinement du week-end et de partager davantage de temps tous ensemble. Le Village propose des chambres traditionnelles ainsi que d'anciens wagons réaménagés en suites privées, avec des options pour les couples, les familles et les groupes.",
      ),
      exploreBtn:    s('Explore Accommodations', 'Découvrir les hébergements'),
    },
    weekend: {
      friday: {
        day:     s('Friday', 'Vendredi'),
        checkin: {
          time: s('5:30 PM', '17 h 30'),
          name: s('Check-in opens at the Village de Sully', 'Accueil au Village de Sully'),
        },
        dinner: {
          time: s('Around 7:00 PM', 'Vers 19 h'),
          name: s('Dinner at the Village Market', 'Dîner au Marché du Village'),
        },
      },
      saturday: {
        day:       s('Saturday', 'Samedi'),
        excursion: {
          time: s('Morning', 'Matin'),
          name: s('Optional Excursion to Giverny', 'Option excursion à Giverny'),
        },
        ceremony: {
          time: s('Around 5:00 PM', 'Vers 17 h'),
          name: s('Ceremony', 'Cérémonie'),
        },
        celebration: {
          time: s('Starting at 6:30 PM', 'Vers 18 h 30'),
          name: s('Cocktail Hour, Dinner & Dancing', 'Cocktail, dîner & soirée dansante'),
        },
      },
      sunday: {
        day:    s('Sunday', 'Dimanche'),
        brunch: {
          time: s('11:30 AM–2:00 PM', '11 h 30–14 h'),
          name: s('Farewell Brunch & Pétanque', 'Brunch & Pétanque'),
        },
      },
    },
    location: {
      heading:        s('The Location', 'Le lieu'),
      mapPlaceholder: s('Interactive map showing Village de Sully and Paris will be added here', 'Une carte interactive montrant le Village de Sully et Paris sera ajoutée ici'),
      context:        s('Village de Sully is located in the Île-de-France region, approximately 60km west of Paris.', "Le Village de Sully est situé en Île-de-France, à environ 60 km à l'ouest de Paris."),
    },
    calendar: {
      heading:         s('Save the Dates', 'Notez les dates'),
      subtext:         s('Add the full weekend to your calendar.', 'Ajoutez le week-end complet à votre agenda.'),
      addBtn:          s('Add to Calendar', "Ajouter à l'agenda"),
    },
    nav: {
      schedule: {
        title: s('The Weekend', 'Le Week-end'),
        desc:  s('Schedule', 'Le programme du mariage'),
      },
      venue: {
        title: s('The Village', 'Le Village'),
        desc:  s('Venue & Accommodations', 'Le Village & les hébergements'),
      },
      couple: {
        title: s('The Couple', 'Les Mariés'),
        desc:  s('About Us', 'Notre histoire'),
      },
      travel: {
        title: s('The Journey', 'Le Voyage'),
        desc:  s('Directions & Travel Tips', 'Préparer votre visite'),
      },
      lookbook: {
        title: s('The Lookbook', 'Le Dress Code'),
        desc:  s('Dress Code & Inspiration', 'Inspiration & idées'),
      },
      registry: {
        title: s('The Registry', 'La Liste de mariage'),
        desc:  s('If You Wish', 'Si vous le souhaitez'),
      },
      rsvp: {
        title: s('RSVP', 'RSVP'),
        desc:  s("Let Us Know You're Coming", 'On vous attend !'),
      },
      faq: {
        title: s('FAQ', 'FAQ'),
        desc:  s('Frequently Asked Questions', 'Questions fréquentes'),
      },
    },

    // /france/lookbook — Lookbook (EN) / Dress Code (FR)
    lookbook: {
      pageTitle: s('Lookbook', 'Dress Code'),
      heading:   s('Lookbook', 'Dress Code'),
      subtitle:  s('Dress Code & Inspiration', 'Inspiration & idées'),
      friday: {
        day:  s('Friday', 'Vendredi'),
        code: s('Garden Party', 'Garden Party'),
        desc: s(
          'Our Friday evening Welcome Dinner will take place outdoors throughout the Village.\n\nExpect a relaxed evening spent mingling, enjoying market-style food stations, and celebrating together under the open sky.\n\nThe Village grounds are paved, so heels are perfectly suitable.',
          'Le dîner de bienvenue du vendredi soir se déroulera en extérieur, dans les différents espaces du Village.\n\nVous passerez la soirée à circuler entre les différents stands, à profiter du dîner et à passer du temps ensemble.\n\nLes allées du Village sont pavées ; les talons ne poseront donc aucun problème.',
        ),
      },
      saturday: {
        day:  s('Saturday', 'Samedi'),
        code: s('Cocktail Attire', 'Cocktail'),
        desc: s(
          "Our ceremony and cocktail hour will take place outdoors on paved surfaces, followed by dinner and dancing indoors.\n\nWe invite you to wear something colorful for the occasion.\n\nThe Village's restored retro charm, somewhere between the 1970s and 1980s, and our love of disco have inspired the weekend's atmosphere, so if you'd like to lean into that spirit, we'd love to see it.\n\nFollowing the French wedding tradition, women are encouraged to wear hats or fascinators.",
          "La cérémonie et le cocktail auront lieu en extérieur, sur des surfaces pavées. Le dîner et la soirée dansante se dérouleront ensuite en intérieur.\n\nNous vous invitons à porter une tenue colorée pour l'occasion.\n\nL'ambiance du Village, avec son charme rétro inspiré des années 1970 et 1980, ainsi que notre amour du disco, ont inspiré l'atmosphère du week-end. Si le cœur vous en dit, n'hésitez pas à vous en inspirer.\n\nDans la belle tradition des mariages français, les chapeaux sont les bienvenus !",
        ),
      },
    },

    // /france/schedule
    schedule: {
      pageTitle:      s('The Weekend', 'Le Week-end'),
      heading:        s('The Weekend', 'Le programme du week-end'),
      subtitle:       s('May 28–30, 2027', '28–30 mai 2027'),
      calendarBtn:    s('Add events to calendar', 'Ajouter des événements à votre calendrier'),
      calendarNote:   s(
        'RSVP to unlock your personalized weekend schedule and add it to your calendar.',
        'Répondez à votre invitation pour ajouter votre programme personnalisé à votre calendrier.',
      ),
      dressCodeLabel: s('Dress Code', 'Dress Code'),
      weather: {
        heading: s('Weather', 'Météo'),
        value:   s('Late May: 60–72°F (15–22°C)', 'Fin mai : 15–22°C (60–72°F)'),
        note:    s('Spring weather varies widely and changes quickly. Layers are recommended to deal with the evening chill.', 'Les températures en mai peuvent varier au cours de la journée. Nous vous recommandons de prévoir une veste légère ou un pull pour les soirées plus fraîches.'),
      },
      friday: {
        heading: s('Friday, May 28', 'Vendredi 28 mai'),
        checkin: {
          time:  s('5:30 PM', '17 h 30'),
          title: s('Check-in Opens', 'Accueil au Village de Sully'),
          desc:  s('Settle into your accommodations at the Village.', 'Prenez le temps de vous installer avant le dîner.'),
        },
        dinner: {
          time:     s('7:00 PM', 'Vers 19 h'),
          title:    s('Dinner at the Village Market', 'Dîner au Marché du Village'),
          location: s('Village Square', 'La Place du Village'),
          desc:     s(
            'Join us for a relaxed evening inspired by a traditional French village market, with seasonal specialties, drinks, and plenty of time to mingle.',
            "Rejoignez-nous pour une soirée conviviale inspirée d'un marché de village, avec des spécialités de saison, des boissons et tout le plaisir de se retrouver.",
          ),
        },
        dressCode: {
          code: s('Garden Party', 'Garden Party'),
          desc: s(
            'The Welcome Dinner will take place outdoors. Come ready to mingle, enjoy market-style food stations, and celebrate together under the open sky. The Village grounds are paved, so heels are perfectly suitable.',
            'Le dîner du vendredi se déroulera en extérieur. Les allées étant pavées, les talons sont parfaitement adaptés.',
          ),
        },
      },
      saturday: {
        heading: s('Saturday, May 29', 'Samedi 29 mai'),
        breakfast: {
          time:  s('9:00 AM–11:00 AM', '9 h à 11 h'),
          title: s('Breakfast', 'Petit déjeuner'),
          desc:  s('Included for guests staying at Village de Sully.', 'Inclus pour les personnes logeant au Village de Sully.'),
        },
        excursion: {
          time:  s('10:00 AM', 'Matin'),
          title: s('Optional Excursion to Giverny', 'Option excursion à Giverny'),
          desc:  s("Explore Claude Monet's home and gardens.", 'Découvrez la maison et les jardins de Claude Monet.'),
        },
        ceremony: {
          time:     s('5:00 PM', 'Vers 17 h'),
          title:    s('Ceremony', 'Cérémonie'),
          location: s('La Mairie du Village', 'La Mairie du Village'),
        },
        cocktail: {
          time:     s('6:30 PM', 'Vers 18 h 30'),
          title:    s('Cocktail Hour', 'Cocktail'),
          location: s('Village Square', 'La Place du Village'),
        },
        reception: {
          time:  s('Evening', 'Soirée'),
          title: s('Dinner & Dancing', 'Dîner & soirée dansante'),
          desc:  s('Dinner, speeches, and dancing late into the night.', 'Dîner, discours et soirée dansante jusque tard dans la nuit.'),
        },
        dressCode: {
          code: s('Cocktail Attire', 'Cocktail'),
          desc: s(
            "We invite you to wear something colorful for the occasion.\n\nThe Village's restored retro charm, somewhere between the 1970s and 1980s, and our love of disco have inspired the weekend's atmosphere, so if you'd like to lean into that spirit, we'd love to see it.\n\nFollowing the French wedding tradition, women are encouraged to wear hats or fascinators.",
            "Nous vous invitons à porter une tenue colorée pour l'occasion.\n\nL'ambiance du Village, avec son charme rétro des années 1970 et 1980, ainsi que notre amour du disco, ont inspiré l'atmosphère du week-end. Si le cœur vous en dit, n'hésitez pas à vous inspirer du charme rétro années 70-80 du Village !\n\nEt si vous cherchiez une bonne occasion de porter un chapeau, la voici !",
          ),
        },
      },
      sunday: {
        heading: s('Sunday, May 30', 'Dimanche 30 mai'),
        breakfast: {
          time:  s('9:00 AM–11:00 AM', '9 h à 11 h'),
          title: s('Breakfast', 'Petit déjeuner'),
          desc:  s('Included for guests staying at Village de Sully.', 'Inclus pour les personnes logeant au Village de Sully.'),
        },
        brunch: {
          time:     s('11:30 AM–2:00 PM', '11 h 30–14 h'),
          title:    s('Farewell Brunch & Games', 'Brunch & jeux'),
          location: s('Village Square', 'La Place du Village'),
          desc:     s(
            'Join us for one last morning of brunch, games, and good company before the weekend comes to a close.',
            'Rejoignez-nous pour un brunch, quelques parties de pétanque et pour profiter ensemble des derniers instants du week-end.',
          ),
        },
        dressCode: {
          code: s('Casual', 'Décontracté'),
          desc: s('', ''),
        },
        venueCloses: {
          time:  s('4:00 PM', '16 h'),
          title: s('Venue Closes', 'Fermeture du Village'),
        },
      },
    },

    // /france/details — The Village
    details: {
      pageTitle: s('The Village', 'Le Village'),
      heading:   s('The Village', 'Le Village'),
      subtitle:  s('Village de Sully', 'Village de Sully'),
      intro:     s(
        "We'll be spending the entire wedding weekend together at Village de Sully. Every event, from Friday evening's welcome dinner to Sunday's brunch, takes place within the Village, so once you arrive, all you have to do is settle in and enjoy the weekend with us.",
        "Nous passerons tout notre week-end de mariage au Village de Sully. Tous les événements, du dîner de bienvenue du vendredi soir au brunch du dimanche, se dérouleront au sein du Village. Une fois sur place, il ne vous restera plus qu'à vous installer et profiter pleinement du week-end avec nous.",
      ),
      location: {
        heading:       s('Location', 'Où'),
        line1:         s('Rosny-sur-Seine, France', 'Rosny-sur-Seine, France'),
        line2:         s('Approximately 45 minutes from Paris', 'À environ 45 minutes de Paris'),
        appleMapLink:  s('View on Apple Maps ↗', 'Voir sur Apple Maps ↗'),
        googleMapLink: s('View on Google Maps ↗', 'Voir sur Google Maps ↗'),
      },
      highlights: {
        heading: s('Village Highlights', 'Les incontournables du Village'),
        place: {
          title: s('La Place du Village', 'La Place du Village'),
          desc:  s(
            "The heart of the Village and the setting for much of the weekend's celebrations.",
            'Le cœur du Village, où nous nous retrouverons pour les cocktails, les repas et les festivités tout au long du week-end.',
          ),
        },
        bistrot: {
          title: s('Bistrot des Amis', 'Le Bistrot des Amis'),
          desc:  s(
            'The perfect spot to grab a drink, play a game, and unwind throughout the weekend.',
            "L'endroit idéal pour prendre un verre, jouer au baby-foot ou simplement profiter du Village tout au long du week-end.",
          ),
        },
        felix: {
          title: s('Félix Potin', 'Félix Potin'),
          desc:  s(
            'A nod to the village grocery stores of another era.',
            "Un clin d'œil à l'épicerie de village d'autrefois.",
          ),
        },
        gare: {
          title: s('La Gare', 'La Gare'),
          desc:  s(
            'The historic train station, platform, terrace, and beautifully restored Orient Express train cars that guests will call home for the weekend.',
            'Son quai, sa terrasse et ses anciens wagons transformés en chambres.',
          ),
        },
        mairie: {
          title: s('La Mairie', 'La Mairie'),
          desc:  s(
            'Our outdoor ceremony will take place in front of the Village Mairie, with seating for all guests.',
            'La cérémonie se déroulera en plein air, devant la Mairie du Village.',
          ),
        },
      },
      staying: {
        heading: s('Staying at the Village', 'Dormir au Village'),
        callout: s(
          "Staying at the Village is the best way to enjoy the full wedding weekend. You'll be just steps away from every event, with more time to relax, celebrate, and enjoy the Village together.",
          'Dormir sur place est la meilleure façon de profiter pleinement du week-end. Vous serez à quelques pas de chaque événement, avec plus de temps pour vous détendre, célébrer et profiter du Village ensemble.',
        ),
      },
      overview: {
        heading: s('Overview', 'Votre séjour'),
        items: [
          s('Private accommodations are available for couples, families, and larger groups.', 'Des chambres sont disponibles pour les couples, les familles et les groupes.'),
          s('Village Rooms (limited availability)', 'Chambres du Village (Disponibilité limitée)'),
          s('Orient-Express train car suites', 'Suites dans les wagons Orient-Express'),
          s('Louisiana train car suites', 'Suites dans les wagons Louisiane'),
          s('Breakfast included each morning', 'Petit déjeuner inclus chaque matin'),
          s('Check-in: Friday from 5:30 PM', 'Arrivée le vendredi à partir de 17 h 30'),
          s('Rooms should be cleared by Sunday, 12:00 PM. Bag storage will be available.', 'Les chambres devront être libérées le dimanche avant 12 h. Une bagagerie sera disponible.'),
          s("You're welcome to continue enjoying the Village until 4:00 PM.", 'Vous pourrez ensuite continuer à profiter du Village jusqu\'à 16 h.'),
        ],
      },
      booking: {
        heading: s('Booking', 'Réservation'),
        reserve: s('Reserve your accommodations through your RSVP.', 'Réservez votre chambre lors de votre RSVP.'),
        pricing: s(
          'Room options and pricing vary depending on your party size, with rooms starting at €150 per night for double occupancy. Private accommodations are available for couples, families, and larger groups.',
          'Les tarifs varient selon la taille de votre groupe, avec des chambres doubles à partir de 150 € la nuit. Des chambres sont disponibles pour les couples, les familles et les groupes.',
        ),
        followup: s(
          "We'll be in touch after the RSVP deadline to confirm your room assignment and accommodation details. If you have any questions or need special accommodations, please reach out by email or text.",
          "Nous vous contacterons après la date limite des RSVP pour confirmer les détails de votre chambre. Si vous avez des questions ou des besoins particuliers, n'hésitez pas à nous écrire ou à nous envoyer un texto.",
        ),
      },
      roomTypes: {
        heading: s('Room Types', 'Types de chambres'),
        village: {
          title: s('Village Rooms (Limited Availability)', 'Chambres du Village (Disponibilité limitée)'),
          desc:  s('Traditional guest rooms located throughout the Village buildings.', 'Réparties dans les bâtiments historiques du Village.'),
        },
        orient: {
          title: s('Orient-Express Train Cars', 'Wagons Orient-Express'),
          desc:  s('Restored Orient-Express train car suites with private bathrooms and air conditioning.', "Chambres avec salle de bain privée aménagées dans d'anciens wagons de l'Orient-Express entièrement restaurés. Tous les wagons sont climatisés."),
        },
        louisiana: {
          title: s('Louisiana Train Cars', 'Wagons Louisiane'),
          desc:  s('Restored Louisiana train car suites with private bathrooms and air conditioning.', "Chambres avec salle de bain privée aménagées dans d'anciens wagons entièrement restaurés. Tous les wagons sont climatisés."),
        },
      },
    },

    // /france/travel
    travel: {
      pageTitle: s('France Travel', 'Voyager en France'),
      heading:   s('Travel', 'Voyage'),
      subtitle:  s('Getting to Village de Sully', 'Comment se rendre au Village de Sully'),
      toFrance: {
        heading: s('Getting to France', 'Comment venir en France'),
        air: {
          heading: s('By Air', 'En avion'),
          intro:   s('Paris has two major international airports:', 'Paris possède deux grands aéroports internationaux :'),
          cdg:     s(
            "Paris CDG (Charles de Gaulle) — Most American flights arrive here. It is easy to reach central Paris by bus, taxi, RER train and — if we're lucky — the express train will begin operations just before we all arrive.",
            "Paris CDG (Charles de Gaulle) — La plupart des vols en provenance des États-Unis y arrivent. Il est facile de rejoindre le centre de Paris en bus, en taxi, en RER et, avec un peu de chance, la liaison express sera mise en service juste avant notre arrivée.",
          ),
          orly:    s(
            'Paris Orly — Low-cost airlines from the US and some European domestic flights arrive here. The Paris Metro has recently been expanded to ORY and runs directly to the city center.',
            "Paris Orly — Certaines compagnies low cost depuis les États-Unis et des vols intérieurs européens y arrivent. Le métro parisien dessert désormais ORY directement jusqu'au centre-ville.",
          ),
        },
        eurostar: {
          heading: s('By Train (Eurostar)', 'En train (Eurostar)'),
          text:    s(
            'From London and Amsterdam, the Eurostar runs to Paris Gare du Nord. Book early for the best fares.',
            "Depuis Londres et Amsterdam, l'Eurostar dessert Paris Gare du Nord. Réservez tôt pour les meilleurs tarifs.",
          ),
        },
        metroTickets: {
          beforeLink: s('You can now buy your Metro and RER tickets directly', 'Vous pouvez désormais acheter directement vos billets de métro et de RER'),
          linkText:   s('on your phone', 'sur votre téléphone'),
          afterLink:  s('for convenience.', 'pour plus de simplicité.'),
        },
      },
      toVenue: {
        heading: s('Getting to the Venue from Paris', 'Comment se rendre au lieu depuis Paris'),
        intro:   s('Village de Sully is in the Île-de-France region, approximately 60km west of Paris.', "Le Village de Sully est en Île-de-France, à environ 60 km à l'ouest de Paris."),
        train: {
          heading: s('By Train', 'En train'),
          step1:   s(
            'Take a Transilien train (Line J or N) or the TER Normandie from Paris Saint-Lazare to Mantes-la-Jolie. The trip takes 40 to 50 minutes depending on which route you use.',
            "Prenez un train Transilien (ligne J ou N) ou le TER Normandie depuis Paris Saint-Lazare jusqu'à Mantes-la-Jolie. Le trajet dure entre 40 et 50 minutes selon l'itinéraire.",
          ),
          step2:   s(
            'Many SNCF trains also stop at Mantes-la-Jolie.',
            'De nombreux trains SNCF desservent également Mantes-la-Jolie.',
          ),
          step3:   s(
            'From Mantes-la-Jolie, the venue is only a 10 minute drive. Ubers are available around the station, and taxis are right in front.',
            "Depuis Mantes-la-Jolie, le lieu n'est qu'à 10 minutes en voiture. Des Uber sont disponibles autour de la gare et des taxis se trouvent juste devant.",
          ),
          mobilitesNote: s('We recommend downloading the Île-de-France Mobilités app before you travel.', "Nous vous recommandons de télécharger l'application Île-de-France Mobilités avant votre voyage."),
          mobilitesBtn:  s('Île-de-France Mobilités', 'Île-de-France Mobilités'),
        },
        car: {
          heading:              s('By Car', 'En voiture'),
          text:                 s(
            'Approximately one hour from central Paris via the A13, depending on traffic. Travel times may be longer during rush hour. Complimentary parking is available at Village de Sully.',
            "Environ une heure depuis le centre de Paris via l'A13, selon la circulation. Le trajet peut être plus long aux heures de pointe. Le Village de Sully dispose d'un parking gratuit.",
          ),
          directionsBeforeLink: s('Driving directions are available', 'Les indications routières sont disponibles'),
          directionsLinkText:   s('here', 'ici'),
          directionsAfterLink:  s('.', '.'),
          tolls:                s('Please note that France uses automated speed cameras and many highways include tolls.', ''),
        },
      },
      // ETIAS & International Driving Permit — English site only (French page omits both)
      etias: {
        heading:      en('ETIAS Travel Authorization'),
        text:         en('Beginning in 2027, U.S. passport holders traveling to France will need an ETIAS travel authorization before departure. Applications are completed online through the official European Union website. Most applications are approved within minutes, though some may take up to 30 days. We recommend applying several weeks before your trip. The application fee is €20.'),
        passportNote: en('Make sure your passport is valid for your trip and check its expiration date well before departure.'),
        btn:          en('Official ETIAS Website'),
      },
      idp: {
        heading: en('International Driving Permit'),
        text:    en('Visitors from the United States planning to rent a car should obtain an International Driving Permit before leaving the U.S. It is required in France and must be obtained before departure.'),
        btn:     en('International Driving Permit (AAA)'),
      },
      // Practical Information — English site only (French page omits this section)
      practical: {
        heading: en('Practical Information'),
        timezone:    { heading: en('Time Zone'),        text: en('France is six hours ahead of New York.') },
        weather:     { heading: en('Weather'),          text: en('Late May: 60–72°F (15–22°C). Spring weather varies widely and changes quickly. Layers are recommended to deal with the evening chill.') },
        payment:     { heading: en('Payment Methods'),  text: en('Contactless payment and chip cards are widely accepted. Cash is still preferred for some smaller purchases, particularly at markets and local bakeries. American Express is not accepted at many businesses.') },
        electricity: { heading: en('Electricity'),      text: en('France uses Type C and Type E electrical outlets (230V). Travelers from the U.S. will need a plug adapter.') },
        mobile:      { heading: en('Mobile Service'),   text: en('International roaming plans are available through most carriers. Free Wi-Fi is available throughout Village de Sully.') },
        whatsapp:    { heading: en('WhatsApp'),         text: en('WhatsApp is widely used in France. We recommend downloading it before your trip, as many people, businesses, and service providers prefer it for communication.') },
        water:       { heading: en('Drinking Water'),   text: en('Tap water is safe to drink throughout France. We recommend bringing a reusable water bottle to refill during your stay.') },
        pharmacies:  { heading: en('Pharmacies'),       text: en('Pharmacies are easy to find throughout France and are an excellent resource for minor illnesses, medications, and health advice.') },
        tipping:     { heading: en('Tipping'),          text: en('Service is included at restaurants in France. Tipping is never expected but is always appreciated for exceptional service.') },
        uber:        { heading: en('Uber & Taxis'),     text: en('Uber is available in Paris and the surrounding area, though availability may be more limited near Village de Sully. Local taxis are also available.') },
      },
    },

    // /france/rsvp
    rsvp: {
      pageTitle:    s('France RSVP', 'RSVP France'),
      heading:      s('RSVP', 'RSVP'),
      subtitle:     s('France · May 28–30, 2027', 'France · 28–30 mai 2027'),
      deadline:     s('Please respond by', 'Merci de répondre avant le'),
      deadlineDate: RSVP_DEADLINE_FRANCE,
      unavailable: {
        heading: s('RSVP Unavailable', 'RSVP indisponible'),
        text:    s(
          'RSVP submissions require the Notion guest backend. Please log in again once that integration is enabled.',
          "Les RSVP nécessitent l'intégration Notion. Veuillez vous reconnecter une fois celle-ci activée.",
        ),
      },
      loadError: {
        heading: s('Unable to Load RSVP', 'Impossible de charger le RSVP'),
      },
      existingBanner: {
        prefix: s("You've already RSVP'd, but you can update it here until", "Vous avez déjà répondu, mais vous pouvez le modifier ici jusqu'au"),
      },
      confirmation: {
        pageTitle:    s('France RSVP Confirmation', 'Confirmation RSVP France'),
        heading:      s('RSVP Saved', 'RSVP enregistré'),
        subtitle:     s('Here is your latest response for France.', 'Voici votre dernière réponse pour la France.'),
        savedLabel:   s('Thank you! Your RSVP was last updated at', 'Merci ! Votre RSVP a été mis à jour pour la dernière fois à'),
        editLink:     s('Edit RSVP', 'Modifier le RSVP'),
        emptyValue:   s('Not provided', 'Non renseigné'),
        emailMissing: s('No email provided', "Aucune adresse email renseignée"),
        missing: {
          heading: s('No RSVP Found', 'Aucun RSVP trouvé'),
          text:    s('We could not find a saved France RSVP for your invitation yet.', "Nous n'avons pas encore trouvé de RSVP enregistré pour votre invitation France."),
        },
      },
      form: {
        whosComing: {
          heading: s("Who's Coming?", 'Qui vient ?'),
          note:    s("Toggle each guest's attendance and edit names if needed.", 'Indiquez la présence de chaque invité et modifiez les noms si nécessaire.'),
        },
        coreEvents: {
          heading: s('Events', 'Événements'),
          note:    s('Please confirm your attendance for the following events.', 'Merci de nous indiquer les événements auxquels vous participerez.'),
          empty:   s('No core events are assigned to this invitation yet.', "Aucun événement principal n'est encore assigné à cette invitation."),
        },
        optionalEvents: {
          heading: s('Morning Excursion to Giverny', 'Excursion à Giverny'),
          note:    s("Let us know if you'd like to join us for the excursion! More details coming soon.", "Dites-nous si vous souhaitez participer à cette excursion ! Plus d'informations seront communiquées prochainement."),
          empty:   s('No optional events are assigned right now.', "Aucun événement optionnel n'est assigné pour le moment."),
        },
        dietary: {
          heading:      s('Dietary Needs & Allergens', 'Besoins alimentaires & allergènes'),
          note:         s('Please let us know about any allergies or dietary restrictions.', 'Merci de nous indiquer toute allergie ou restriction alimentaire.'),
          childrenNote: s("For children, a children's menu is available. Please let us know if you'd like us to reserve one for your child.", 'Un menu enfant est également proposé. Merci de nous indiquer si vous souhaitez en réserver un pour votre enfant.'),
          placeholder:  s('List allergens or dietary restrictions', 'Listez les allergènes ou restrictions alimentaires'),
        },
        accommodation: {
          heading:  s('Accommodations', 'Chambre'),
          intro:    s(
            "We hope you'll choose to stay with us at Village de Sully. Staying on site is the best way to enjoy the full wedding weekend. You'll be just steps away from every event, with more time to relax, celebrate, and enjoy the Village together.",
            'Dormir sur place est la meilleure façon de profiter pleinement du week-end. Vous serez à quelques pas de chaque événement, avec plus de temps pour vous détendre, célébrer et profiter du Village ensemble.',
          ),
          question: s('Would you like to reserve accommodations at Village de Sully?', 'Souhaitez-vous réserver une chambre au Village de Sully ?'),
          unsure:   s("I'm not sure yet", "J'y réfléchis"),
          yes:      s("Yes, I'd like to stay at Village de Sully", 'Oui, je souhaite dormir au Village de Sully'),
          no:       s("No thanks, I won't need accommodations", "Non merci, je n'aurai pas besoin de chambre"),
          // French provided by Sam (2026-07-18) — provisional, shared with the event error for now
          required: s("Please let us know if you'd like to reserve accommodations.", 'Merci de choisir votre réponse'),
          followup: s("We'll be in touch after the RSVP deadline to confirm your room assignment and accommodation details.", 'Nous vous contacterons après la date limite des RSVP pour confirmer les détails de votre chambre.'),
        },
        transport: {
          heading: s('Transport Help', 'Aide au transport'),
          note:    s('Do you need help arranging transport?', "Avez-vous besoin d'aide pour organiser votre transport ?"),
          unsure:  s('Not sure yet', 'Pas encore sûr(e)'),
          yes:     s('Yes, I need assistance', "Oui, j'ai besoin d'aide"),
          no:      s('No, I will arrange my own', "Non, je m'en occupe"),
        },
        message: {
          heading:     s('Message for Us', 'Message pour nous'),
          note:        s("Anything else you'd like us to know? Please use this space to share any additional accommodation, accessibility, or other special requests.", "Y a-t-il autre chose que nous devrions savoir ? Merci d'utiliser cet espace pour nous faire part de tout besoin particulier concernant votre chambre, l'accessibilité ou toute autre demande."),
          placeholder: s('Share your well wishes or anything else we should know', 'Partagez vos vœux ou tout ce que nous devrions savoir'),
        },
        email: {
          heading:          s('Confirmation Email', 'Confirmation par e-mail'),
          label:            s('Email address', 'Adresse email'),
          optional:         s('(optional)', '(facultatif)'),
          placeholder:      s('you@example.com', 'vous@exemple.com'),
          sendConfirmation: s('Send me an email confirmation', "M'envoyer une confirmation par e-mail"),
          note:             s("We'll send a confirmation of your RSVP to the email addresses below. We'll also use these addresses to share any important wedding updates.", 'Nous vous enverrons une confirmation de votre RSVP aux adresses e-mail ci-dessous. Nous utiliserons également ces adresses pour vous communiquer toute information importante concernant le week-end du mariage.'),
          requireOne:       s('At least one email address is required. We recommend adding an email address for everyone in your party.', 'Au moins une adresse email est requise. Nous recommandons de renseigner une adresse email pour chaque membre de votre groupe.'),
          requireAll:       s('An email address is required for each guest.', 'Une adresse email est requise pour chaque invité.'),
        },
        lastSubmittedLabel: s('Last submitted:', 'Dernière soumission :'),
        submitBtn:  s('Submit RSVP', 'Confirmer ma présence'),
        updateBtn:  s('Update RSVP', 'Mettre à jour mon RSVP'),
        successMsg: s('RSVP submitted successfully.', 'RSVP envoyé avec succès.'),
        errorMsg:   s('We could not submit your RSVP. Please try again.', "Nous n'avons pas pu envoyer votre RSVP. Veuillez réessayer."),
        signedInAs: s('Signed in as', 'Vous répondez en tant que'),
        canUpdate:  { en: 'You can update your response anytime before the deadline.', fr: `Vous pourrez modifier votre réponse à tout moment jusqu'au ${RSVP_DEADLINE_FRANCE.fr}.` },
      },
    },

    // /france/faq
    faq: {
      pageTitle: s('FAQ', 'FAQ'),
      heading:   s('FAQ', 'FAQ'),
      subtitle:  s('Frequently Asked Questions', 'Questions fréquentes'),
      moreQuestions: s('Still have questions? Email us at', 'Vous avez encore des questions ? Écrivez-nous à'),
      items: {
        travelInfo: {
          q: s('How do I get to the Village de Sully?', 'Comment rejoindre le Village de Sully ?'),
          a: s(
            "Most travel questions are answered on the Travel page, including flights, trains, driving, and practical information for your trip.\n\nIf you still have questions, please don't hesitate to reach out to us by email or text. We'd be happy to help.",
            "Consultez la page Voyage pour tout savoir sur les transports et l'organisation de votre séjour. Si vous avez d'autres questions, n'hésitez pas à nous écrire.",
          ),
          ctaHref:  '/france/travel',
          ctaLabel: s('Go to the Travel page →', 'Voir la page Voyage →'),
        },
        stay: {
          q: s('Where should I stay?', 'Où puis-je trouver des informations sur les hébergements ?'),
          a: s(
            "We hope you'll stay with us at Village de Sully. Room options, pricing, and reservation details are available on The Village page.",
            'Consultez la page Le Village & les hébergements pour découvrir les différents types de chambres, les modalités de réservation et toutes les informations utiles concernant votre séjour.',
          ),
          ctaHref:  '/france/details',
          ctaLabel: s('Go to The Village page →', 'Voir la page Le Village →'),
        },
        wifi: {
          q: s('Is Wi-Fi available?', 'Le Village dispose-t-il du Wi-Fi ?'),
          a: s(
            'Yes! Wifi is available throughout the Village.',
            'Oui, le Wi-Fi est disponible gratuitement dans tout le Village de Sully.',
          ),
        },
        rsvpDeadline: {
          q: s('When is the RSVP deadline?', 'Jusqu\'à quand puis-je répondre ?'),
          a: { en: `Please RSVP by ${RSVP_DEADLINE_FRANCE.en}.`, fr: `Merci de nous répondre avant le ${RSVP_DEADLINE_FRANCE.fr}.` },
        },
        updateRsvp: {
          q: s('Can I update my RSVP if my plans change?', 'Puis-je modifier mon RSVP ?'),
          a: s(
            'Of course. You can update your RSVP through the web form at any time until the RSVP deadline.',
            'Bien sûr ! Si vos projets changent après votre réponse, merci de nous prévenir dès que possible par e-mail ou par message.',
          ),
        },
        plusOne: {
          q: s('Can I bring a plus-one?', 'Puis-je venir avec un(e) invité(e) ?'),
          a: s(
            'Due to limited space, we are only able to accommodate the guests listed on your invitation.',
            'En raison du nombre de places limité, seules les personnes mentionnées sur votre invitation pourront être accueillies.',
          ),
        },
        children: {
          q: s('Are children invited?', 'Les enfants sont-ils invités ?'),
          a: s(
            'Only children listed on your RSVP are included in the invitation. Children are welcome to join us for Friday evening\'s festivities and Sunday\'s brunch.\n\nFor Saturday, we have chosen to reserve the ceremony and reception for adults. We would be happy to recommend childcare options for families who need them.',
            'Toutes les personnes invitées, y compris les enfants, figurent sur votre RSVP. Les enfants sont les bienvenus le vendredi soir et le dimanche pour le brunch. Le samedi, la cérémonie et la réception seront réservées aux adultes. Si besoin, nous serons ravis de vous recommander des solutions de garde d\'enfants à proximité.',
          ),
        },
        dressCode: {
          q: s('Is there a dress code?', 'Y a-t-il un dress code ?'),
          a: s(
            "Yes, and we hope you will have fun with it!\n\nFriday evening: **Garden Party**.\n\nSaturday: **Cocktail Attire**.\n\nThe weekend is our joyful celebration with you. Vibrant colors and playful prints are highly encouraged.\n\nIn true French wedding tradition, we'd also love to see a few fabulous hats and fascinators!\n\nPlease visit the **Lookbook** page for additional inspiration.",
            'Oui. Le vendredi soir, le dress code est Garden Party, et le samedi Cocktail. Nous vous invitons également à porter une tenue colorée. Dans la belle tradition des mariages français, les chapeaux sont les bienvenus ! Rendez-vous sur la page Dress Code pour plus de détails et quelques inspirations.',
          ),
          ctaHref:  '/france/lookbook',
          ctaLabel: s('Go to the Lookbook page →', 'Voir la page Dress Code →'),
        },
        parking: {
          q: s('Where should I park?', 'Où puis-je me garer ?'),
          a: s(
            'Complimentary parking is available at Village de Sully throughout the weekend.',
            'Un parking gratuit est à la disposition de tous les invités au Village de Sully.',
          ),
        },
        partWeekend: {
          q: s('Can I attend only part of the weekend?', 'Puis-je participer à seulement une partie du week-end ?'),
          a: s(
            "Absolutely. While we'd love for you to join us for the entire weekend, we understand that everyone's travel plans are different. Please RSVP for the events you'll be attending so we can plan accordingly.",
            'Bien sûr ! Nous serions ravis de vous retrouver tout au long du week-end, mais nous comprenons que chacun ait ses contraintes. Merci de répondre uniquement aux événements auxquels vous pourrez participer.',
          ),
        },
        dietary: {
          q: s('What if I have dietary restrictions?', "Que faire si j'ai un régime alimentaire particulier ?"),
          a: s(
            '**Friday:** The Friday evening menu will include vegetarian and pescatarian options.\n\n**Saturday:** Cocktail hour will include vegetarian and pescatarian options, and dinner will be fully vegetarian.\n\n**Sunday:** Brunch will include vegetarian options.\n\nPlease note, the food will not be prepared in a kosher kitchen.\n\nIf you have a serious allergy or require another accommodation, please let us know when you RSVP.',
            "Le vendredi soir, plusieurs options végétariennes et pescétariennes seront proposées, mais les plats ne seront pas préparés dans une cuisine casher.\n\nLe samedi, le cocktail et le dîner proposeront également des options végétariennes et pescétariennes. Le dîner sera entièrement végétarien. Si vous avez une allergie ou un besoin alimentaire particulier, merci de nous l'indiquer lors de votre RSVP.",
          ),
        },
        saturdayMorning: {
          q: s('Is anything happening Saturday morning?', 'Que se passe-t-il le samedi matin ?'),
          a: s(
            "Nothing formal is planned before the ceremony, so we encourage you to explore the area.\n\nWe'll also be offering an optional excursion to Giverny to visit Claude Monet's home and water lily gardens. More details will be shared soon, but if you're interested, please RSVP so we can plan accordingly.\n\nIf you're looking for lunch before the festivities begin, you'll find plenty of great options nearby in Mantes-la-Jolie.\n\nIf you are Shomer Shabbat, please reach out to us.",
            "Rien de formel n'est prévu avant la cérémonie. Nous vous invitons à profiter de la région ou à participer à notre excursion facultative à Giverny pour découvrir la maison et les jardins de Claude Monet. Plus d'informations seront communiquées prochainement. Si cette sortie vous intéresse, merci de l'indiquer dans votre RSVP afin que nous puissions nous organiser. Si vous souhaitez déjeuner avant les festivités, vous trouverez de nombreuses bonnes adresses à Mantes-la-Jolie.",
          ),
        },
        rain: {
          q: s('What happens in case of rain?', 'Que se passe-t-il en cas de pluie ?'),
          a: s(
            'We have a rain plan in place, so the celebration will go on rain or shine.',
            'En cas de pluie, tout est prévu pour que les festivités se déroulent dans les meilleures conditions.',
          ),
        },
        unplugged: {
          q: s('Is the ceremony unplugged?', 'Puis-je prendre des photos pendant la cérémonie ?'),
          a: s(
            "Yes.\n\nWe kindly ask that you keep phones and cameras tucked away during the ceremony so everyone can be fully present.\n\nOur photographer will capture the moment, and we'll be excited to share the photos with you afterward on our website.",
            'Nous vous remercions de garder vos téléphones et appareils photo de côté pendant la cérémonie afin que chacun puisse profiter pleinement de ce moment. Nos photographes immortaliseront ces instants et nous serons ravis de partager la galerie sur notre site après le mariage.',
          ),
        },
        registry: {
          q: s('Is there a gift registry?', 'Avez-vous une liste de mariage ?'),
          a: s(
            "We're so grateful to celebrate with you. Your presence is the greatest gift.\n\nShould you feel inclined to give a gift, we've included a few ideas on our registry.",
            'Votre présence est le plus beau des cadeaux, et nous sommes très heureux de partager ce week-end avec vous. Si vous souhaitez nous faire plaisir, vous trouverez quelques idées sur notre liste de mariage.',
          ),
          ctaHref:  '/registry',
          ctaLabel: s('Go to the Registry page →', 'Voir la liste de mariage →'),
        },
      },
      hairMakeup: {
        q:     s('Hair & Makeup', 'Où puis-je me faire coiffer ou maquiller ?'),
        intro: s(
          'There are several salons located nearby in Mantes-la-Jolie. Recommendations include:',
          'Plusieurs salons de coiffure et instituts de beauté se trouvent à Mantes-la-Jolie, à une quinzaine de minutes du Village. En voici quelques-uns que nous vous recommandons :',
        ),
        salons: [
          { name: "Natur'al Coiffure", href: 'https://www.natural-coiffure.com/#bookAppointment' },
          { name: 'Nel Glow Up',       href: 'https://www.planity.com/nel-glow-up-yumi-lashes-expert-lpg-78200-mantes-la-jolie' },
          { name: 'Beauty Ladys 78',   href: 'https://www.planity.com/beauty-ladys-78-78200-mantes-la-jolie' },
        ],
      },
      contact: {
        q:       s('Who should I contact if I have questions?', "Qui contacter si j'ai une question ?"),
        intro:   s("Please don't hesitate to reach out to us.", "N'hésitez pas à nous écrire !"),
        email:   'hello@sargaux.com',
        margaux: s('Margaux: +1 (203) 260-3260 (Text or WhatsApp)', 'Margaux : +1 203-260-3260 (SMS ou WhatsApp)'),
        sam:     s('Sam: (202) 374-1076', 'Sam : +1 202-374-1076 (SMS ou WhatsApp)'),
      },
    },
  },

  // ─────────────────────────────────────────
  // Registry
  // ─────────────────────────────────────────
  registry: {
    pageTitle: s('Registry', 'Liste de mariage'),
    heading:   s('Registry', 'Liste de mariage'),
    // TODO(sam/margaux): French copy needed for all strings below — English placeholders
    intro: s(
      "Your presence is the greatest gift we could ask for. But for those who insist, we've put together a registry of experiences and a few items for our home.",
      "Your presence is the greatest gift we could ask for. But for those who insist, we've put together a registry of experiences and a few items for our home.",
    ),
    fundsHeading:   s('Funds', 'Funds'),
    giftsHeading:   s('Gifts', 'Gifts'),
    claimedHeading: s('Already claimed', 'Already claimed'),
    claimedLabel:   s('Fully claimed', 'Fully claimed'),
    viewOnJoy:       s('View on Joy →', 'View on Joy →'),
    contributeOnJoy: s('Contribute on Joy →', 'Contribute on Joy →'),
    fallback: {
      title: s('Our registry lives on Joy', 'Our registry lives on Joy'),
      body:  s(
        "We couldn't load the registry here just now — you can browse everything directly on Joy.",
        "We couldn't load the registry here just now — you can browse everything directly on Joy.",
      ),
      cta:   s('Open our registry on Joy →', 'Open our registry on Joy →'),
    },
  },
};
