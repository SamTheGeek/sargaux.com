/**
 * Centralised copy for all user-visible text on the site.
 *
 * Every string has an English ('en') and French ('fr') variant.
 * French translations are a first-pass — Margaux should review during the copy-edit sprint.
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

/** RSVP deadline dates — single source of truth for each event */
export const RSVP_DEADLINE_NYC    = { en: 'September 1, 2026',  fr: '1er septembre 2026' } satisfies T;
export const RSVP_DEADLINE_FRANCE = { en: 'April 15, 2027',     fr: '15 avril 2027'      } satisfies T;
export const NYC_EVENT_TIME       = { en: '5:30 PM - 9 PM',     fr: '17h30 - 21h00'      } satisfies T;

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
  },

  // ─────────────────────────────────────────
  // Homepage
  // ─────────────────────────────────────────
  home: {
    pageTitle:  s('Homepage', 'Accueil'),
    heroTitle:  s('Chez Sargaux', 'Chez Sargaux'),
    tagline:    s('Sam & Margaux', 'Sam & Margaux'),
    ctaEnter:   s('Entrée', 'Entrée'),
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
      checkingBtn:  s('Checking...', 'Vérification...'),
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
    subtitle: s('A first place for the two of us. We will build this out over time.', 'Un premier espace pour nous deux. Nous le développerons progressivement.'),
    photoLabel: s('Photo One', 'Photo Un'),
    photoCaption: s('A first image from the archive.', "Une première image de l'archive."),
    navLabel: s('Event Pages', 'Pages événement'),
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
      heading:    s('Where', 'Où'),
      dinner:     s('Bar Blondeau', 'Bar Blondeau'),
      dinnerType: s('Cocktails & Dinner', 'Cocktail & Dîner'),
      separator:  s('followed by', 'suivi de'),
      dancing:    s('Dancing (Location TBA)', 'Dancing (lieu à confirmer)'),
    },
    dressCode: {
      heading: s('Dress Code', 'Code vestimentaire'),
      value:   s('Festive Attire', 'Tenue de fête'),
      note:    s('Think jackets but no tie required.', 'Veste recommandée, cravate non obligatoire.'),
    },
    rsvpDeadline: {
      heading: s('RSVP', 'RSVP'),
      value:   { en: `By ${RSVP_DEADLINE_NYC.en}`, fr: `Avant le ${RSVP_DEADLINE_NYC.fr}` },
    },
    calendar: {
      heading:         s('Save the Date', 'Notez la date'),
      subtext:         s("Add the events to your calendar app.", "Ajoutez notre événement à votre agenda pour ne rien manquer."),
      addBtn:          s('Add to Calendar', "Ajouter à l'agenda"),
      unavailableNote: s('Your calendar will be available after you RSVP.', 'Votre calendrier sera disponible après votre RSVP.'),
    },
    nav: {
      details: {
        title: s('Details', 'Détails'),
        desc:  s('Venues & what to expect', 'Lieux & programme'),
      },
      faq: {
        title: s('FAQ', 'FAQ'),
        desc:  s('Questions & answers', 'Questions & réponses'),
      },
      couple: {
        title: s('The Couple', 'Le Couple'),
        desc:  s('Read our story', 'Lire notre histoire'),
      },
      travel: {
        title: s('Travel', 'Voyager'),
        desc:  s('Hotels & getting around', 'Hôtels & déplacements'),
      },
      rsvp: {
        title: s('RSVP', 'RSVP'),
        desc:  s("Let us know you're coming", 'Confirmez votre venue'),
      },
    },
    optional: {
      heading:     s('More to Explore', 'Plus à découvrir'),
      placeholder: s('Optional events throughout the weekend will be listed here once confirmed.', 'Les événements optionnels du week-end seront listés ici une fois confirmés.'),
    },

    // /nyc/details
    details: {
      pageTitle:  s('NYC Details', 'Détails New York'),
      heroTitle:  s('La Soirée', 'La Soirée'),
      subtitle:   s('October 11, 2026', '11 octobre 2026'),
      schedule: {
        heading: s('Schedule', 'Programme'),
        dinner: {
          time:  s('5:30 PM', '17h30'),
          title: s('Cocktails & Bites', 'Cocktails & Bouchées'),
          desc:  s("Cocktails, passed hors d'oeuvres, and small plates", "Cocktails, hors-d'oeuvres passés et petites assiettes"),
        },
        sunset: s('Sunset behind the Manhattan skyline', 'Coucher de soleil derrière la skyline de Manhattan'),
        dancing: {
          time:  s('9:30 PM', '21h30'),
          title: s('Dancing', 'Dancing'),
          desc:  s(
            'Join us as we head to a nearby venue and keep the night going. No reservations, just dancing and continued celebration.',
            'Retrouvez-nous ensuite dans un lieu voisin pour prolonger la soirée. Sans réservation, juste de la danse et la fête qui continue.',
          ),
        },
      },
      venues: {
        heading: s('The Venues', 'Les Lieux'),
        dinner: {
          title:          s('Dinner', 'Dîner'),
          name:           s('Bar Blondeau at the Wythe Hotel', 'Bar Blondeau au Wythe Hotel'),
          address:        s('80 Wythe Ave, 6th Floor · Brooklyn, New York 11249', '80 Wythe Ave, 6e étage · Brooklyn, New York 11249'),
          mapPlaceholder: s('Map will be added here', 'La carte sera ajoutée ici'),
        },
        dancing: {
          title:          s('Dancing', 'Dancing'),
          name:           s('Location TBA', 'Lieu à confirmer'),
          mapPlaceholder: s('Map will be added here', 'La carte sera ajoutée ici'),
        },
      },
      whatToExpect: {
        heading: s('What to Expect', 'Programme de la soirée'),
        text:    s(
          "Celebrate our upcoming marriage with an evening of cocktails, passed hors d'oeuvres, and small plates, with a front-row seat to the New York City sunset.\n\nOur wedding ceremony will be held as an intimate gathering next spring. This evening is our celebration with you!",
          "Célébrez notre futur mariage autour d'une soirée de cocktails, d'hors-d'oeuvres passés et de petites assiettes, avec une place de choix face au coucher de soleil sur New York.\n\nNotre cérémonie de mariage aura lieu lors d'un rassemblement intime au printemps prochain. Cette soirée est notre célébration avec vous !",
        ),
      },
      dressCode: {
        heading: s('Dress Code', 'Code vestimentaire'),
        value:   s('Festive Attire', 'Tenue de fête'),
        note:    s('Think jackets but no tie required. The couple will be in suits.', 'Veste recommandée, cravate non obligatoire. Le couple sera en costume.'),
      },
      calendar: {
        heading: s('Add to Calendar', "Ajouter à l'agenda"),
        btn:     s('Subscribe to Calendar', "S'abonner au calendrier"),
        note:    s('Personalized calendar link based on your RSVP', 'Lien de calendrier personnalisé selon votre RSVP'),
      },
    },

    // /nyc/travel
    travel: {
      pageTitle: s('NYC Travel', 'Voyager à New York'),
      heading:   s('Travel', 'Voyager'),
      subtitle:  s('Getting to and around NYC', 'Comment se rendre à New York et se déplacer'),
      hotels: {
        heading:    s('Hotels', 'Hôtels'),
        intro:      s('Suggested accommodations near the venues:', 'Hébergements suggérés à proximité des lieux :'),
        hotel1:     s('The hotel that hosts our venue at', 'L\'hôtel qui accueille notre lieu au'),
        hotel1BookNow: s('Book now →', 'Réserver →'),
        hotel2:     s('Just down the street from the Wythe at', 'Juste en bas de la rue du Wythe, au'),
        hotel2BookNow: s('Book now →', 'Réserver →'),
        hotel3:     s("Located in Manhattan's NoMad neighborhood at", "Situé dans le quartier NoMad de Manhattan au"),
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
          intro:          s('Take the L train to Bedford Avenue - a 5-minute walk to the venue.', "Prenez la ligne L jusqu'à Bedford Avenue - à 5 minutes à pied du lieu."),
          fareBeforeLink: s('Single ride: $3 (set up ', "Trajet simple : 3 $ (configurez "),
          fareLinkText:   s('Express Transit', 'Transit express'),
          fareAfterLink:  s(' on your phone ahead of time)', " sur votre téléphone à l'avance)"),
          maps:           s('Apple Maps and Google Maps have great subway directions', "Apple Plans et Google Maps proposent d'excellents itinéraires en métro"),
        },
        bike: {
          heading: s('By Bike', 'À vélo'),
          text:    s('A Citi Bike station is located just steps from the Wythe Hotel.', "Une station Citi Bike se trouve à quelques pas du Wythe Hotel."),
        },
        car: {
          heading: s('By Car', 'En voiture'),
          text:    s('Parking is available one block away at 25 Kent.', "Un parking est disponible à un pâté de maisons au 25 Kent Ave."),
        },
      },
      whileHere: {
        heading: s("While You're Here", 'À ne pas manquer'),
        upperEastSide: {
          heading:    s('Museum Mile & Central Park', 'Museum Mile et Central Park'),
          body:       s("Start with a visit to the newly renovated Frick Collection - reserve tickets in advance, and if you're lucky, snag a lunch reservation in the dining room. Afterward, take a leisurely walk through Central Park. For drinks, head to Bemelmans Bar in The Carlyle for one of the most iconic bar experiences in the city.", "Commencez par une visite de la Frick Collection, tout juste rénovée - réservez vos billets à l'avance et, avec un peu de chance, décrochez une réservation pour le déjeuner dans la salle à manger. Ensuite, faites une promenade tranquille dans Central Park. Pour prendre un verre, direction le Bemelmans Bar du Carlyle pour l'une des expériences de bar les plus emblématiques de la ville."),
          alsoInArea: s('Also in the area: The Met, MoMA, the Jewish Museum (free on shabbos!), the American Museum of Natural History, and the Guggenheim.', 'Également dans le quartier : le Met, le MoMA, le Jewish Museum (gratuit le shabbat !), l\'American Museum of Natural History et le Guggenheim.'),
        },
        prospectHeights: {
          heading: s('Follow in Our Footsteps', 'Sur nos traces'),
          body:    s("This is our neighborhood, and we love it. Start your morning with a visit to the Brooklyn Botanic Garden or take a stroll (or bike ride) through Prospect Park. Wander down Vanderbilt Avenue for Unnameable Books, A.Mano decor, great people-watching, and continue our eternal debate between Van Leeuwen and Ample Hills ice cream. For food, brave the line at Radio Bakery for excellent pastries and focaccia, try brunch at Gertie or Cafe Mado, or grab a sandwich at Prospect Heights Butcher or Ciao Gloria and eat outside on the pedestrianized street. For dinner, some of our favorites: Leland, Nuaa Table, Alta Calidad, and Zaytoons.", "C'est notre quartier, et nous l'adorons. Commencez la matinée par le Brooklyn Botanic Garden ou une promenade, voire une balade à vélo, dans Prospect Park. Descendez Vanderbilt Avenue pour Unnameable Books, A.Mano decor, un excellent terrain d'observation, et poursuivez notre débat éternel entre les glaces Van Leeuwen et Ample Hills. Côté repas, affrontez la file de Radio Bakery pour d'excellentes pâtisseries et une focaccia, essayez le brunch chez Gertie ou Cafe Mado, ou prenez un sandwich chez Prospect Heights Butcher ou Ciao Gloria pour le manger dehors dans la rue piétonne. Pour le dîner, quelques-unes de nos adresses préférées : Leland, Nuaa Table, Alta Calidad et Zaytoons."),
        },
        dumbo: {
          heading: s('Where It All Began', 'Là où tout a commencé'),
          body:    s("A beautiful neighborhood where we kindled our relationship. Stroll through Brooklyn Bridge Park and up the bridge into Brooklyn Heights for some of the best views of the Manhattan skyline you'll find anywhere. We highly recommend making the trip by NYC Ferry - it runs from multiple points across Manhattan and Brooklyn, and the ride itself is half the fun. Check out the adaptive reuse of the Brooklyn docks abounding with quiet corners, play spaces, and sports facilities.", "Un très beau quartier où notre histoire a commencé. Promenez-vous dans Brooklyn Bridge Park puis montez jusqu'à Brooklyn Heights pour profiter de quelques-unes des plus belles vues sur la skyline de Manhattan. Nous recommandons vivement d'y aller en NYC Ferry : il part de plusieurs points de Manhattan et de Brooklyn, et le trajet fait déjà la moitié du plaisir. Découvrez aussi la réinvention des anciens docks de Brooklyn, pleins de coins tranquilles, d'espaces de jeux et d'installations sportives."),
        },
        cycling: {
          heading:        s('Sunday Morning Ride', 'Balade du dimanche matin'),
          body:           s('Cycling together is something Sam & Margaux often do together around the city. A quick loop of Prospect Park is a great way to get outdoors and enjoy Brooklyn. CitiBikes are plentiful, and rental shops abound when the weather is nice. For the more adventurous, October is also peak leaf-peeping season. You can follow Sam\'s typical', 'Le vélo est une activité que Sam & Margaux pratiquent souvent ensemble en ville. Un tour de Prospect Park est une excellente façon de profiter de Brooklyn. Les CitiBikes sont nombreux, et les loueurs de vélos abondent quand le temps le permet. Pour les plus aventureux, octobre est aussi la pleine saison des feuillages. Vous pouvez suivre la'),
          linkText:       s('Sunday morning ride', 'sortie dominicale de Sam'),
          bodyAfter:      s('to New Jersey.', 'jusqu\'au New Jersey.'),
        },
      },
    },

    // /nyc/faq
    faq: {
      pageTitle: s('NYC FAQ', 'FAQ New York'),
      heading:   s('FAQ', 'FAQ'),
      subtitle:  s('Questions & answers for the weekend', 'Questions & réponses pour le week-end'),
      moreQuestions: s('More questions? Email us at', 'D’autres questions ? Écrivez-nous à'),
      links: {
        lookbook: s('Lookbook coming soon.', 'Lookbook à venir.'),
        travel:   s('Travel Page', 'Page Travel'),
        travelPrefix: s('See the', 'Voir la'),
        travelSuffix: s('for details and booking links.', 'pour les détails et les liens de réservation.'),
        registry: s('Visit the registry.', 'Voir la liste de mariage.'),
      },
      items: {
        dressCode: {
          question: s('What is the dress code?', 'Quel est le code vestimentaire ?'),
          answer:   s(
            'Festive cocktail attire!',
            'Tenue cocktail festive !',
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
            'La célébration aura lieu au Bar Blondeau, situé au 6e étage du Wythe Hotel à Williamsburg, Brooklyn. Le bar est accessible par le lobby de l’hôtel et par ascenseur. L’espace comprend des zones intérieures et extérieures, avec des assises disponibles, notamment des banquettes et des bancs extérieurs, même si la majeure partie de la soirée se déroulera debout autour d’un cocktail. Nous recommandons des chaussures confortables !',
          ),
        },
        parking: {
          question: s('Is there parking nearby?', 'Y a-t-il un parking à proximité ?'),
          answer:   s(
            'Yes, parking is available near the venue at 25 Kent Avenue.',
            'Oui, un parking est disponible près du lieu au 25 Kent Avenue.',
          ),
        },
        weather: {
          question: s('What will the weather be like?', 'Quel temps fera-t-il ?'),
          answer:   s(
            'New York in October is beautiful. Expect mild autumn weather, typically in the 60s or even 70s during the day. Evenings can cool down to the 50s, so we recommend bringing a layer.',
            'New York en octobre est magnifique. Attendez-vous à une météo automnale douce, généralement autour de 15 à 25 °C en journée. Les soirées peuvent descendre autour de 10 à 15 °C, donc nous vous recommandons d’apporter une petite couche supplémentaire.',
          ),
        },
        foodDrinks: {
          question: s('What food and drinks will be served?', 'Quels plats et boissons seront servis ?'),
          answer:   s(
            "We'll have a full bar with wine, cocktails, and non-alcoholic options, along with passed hors d'oeuvres and small plates throughout the evening. The food will be pescatarian and vegetarian friendly, but will not come from a kosher kitchen. If you have a serious allergy, please let us know when you RSVP.",
            "Nous aurons un bar complet avec vin, cocktails et options sans alcool, ainsi que des hors-d'oeuvres passés et des petites assiettes tout au long de la soirée. Le menu conviendra aux pescétariens et végétariens, mais ne viendra pas d’une cuisine casher. Si vous avez une allergie sérieuse, merci de nous le signaler au moment du RSVP.",
          ),
        },
        ceremony: {
          question: s('Will there be a ceremony?', 'Y aura-t-il une cérémonie ?'),
          answer:   s(
            'There will be no ceremony at this event. Our wedding ceremony and reception will be held separately as an intimate gathering.',
            'Il n’y aura pas de cérémonie lors de cet événement. Notre cérémonie de mariage et la réception auront lieu séparément dans un cadre plus intime.',
          ),
        },
        program: {
          question: s('Will there be speeches or a formal program?', 'Y aura-t-il des discours ou un programme formel ?'),
          answer:   s(
            "This evening is primarily about mingling and celebrating together. We'll have a brief toast from the parents, but no formal program.",
            'Cette soirée sera avant tout consacrée aux retrouvailles et à la fête ensemble. Il y aura un bref toast des parents, mais pas de programme formel.',
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
          question: s('Where should out-of-town guests stay?', 'Où les invités venant de l’extérieur devraient-ils loger ?'),
          answer:   s(
            "We have a few room blocks available in Williamsburg and NoMad. If you need additional suggestions, don't hesitate to reach out!",
            'Nous avons quelques blocs de chambres disponibles à Williamsburg et NoMad. Si vous avez besoin d’autres suggestions, n’hésitez pas à nous contacter !',
          ),
        },
        registry: {
          question: s('Do you have a registry?', 'Avez-vous une liste de mariage ?'),
          answer:   s(
            "Your presence is truly gift enough, and we're so grateful you'll be there to celebrate with us. If you'd like to give something, contributions to our honeymoon fund are always welcome.",
            'Votre présence est déjà un merveilleux cadeau, et nous sommes très reconnaissants que vous soyez là pour célébrer avec nous. Si vous souhaitez offrir quelque chose, une contribution à notre voyage de noces sera toujours la bienvenue.',
          ),
        },
      },
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
        prefix: s('We already have your RSVP. Last saved', 'Nous avons déjà votre RSVP. Dernière sauvegarde le'),
        suffix: s('You can update and submit again anytime.', 'Vous pouvez le modifier et le soumettre à nouveau à tout moment.'),
      },
      confirmation: {
        pageTitle:    s('NYC RSVP Confirmation', 'Confirmation RSVP New York'),
        heading:      s('RSVP Saved', 'RSVP enregistré'),
        subtitle:     s('Here is your latest response for New York.', 'Voici votre dernière réponse pour New York.'),
        savedLabel:   s('Last updated', 'Dernière mise à jour'),
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
          heading:          s('Confirmation Email', 'Email de confirmation'),
          label:            s('Email address', 'Adresse email'),
          optional:         s('(optional)', '(facultatif)'),
          placeholder:      s('you@example.com', 'vous@exemple.com'),
          sendConfirmation: s('Send me an email confirmation', "M'envoyer une confirmation par email"),
          note:             s('Everyone below with an email address will receive the confirmation.', 'Chaque personne ci-dessous avec une adresse email recevra la confirmation.'),
          requireOne:       s('Add at least one email address to receive a confirmation.', 'Ajoutez au moins une adresse email pour recevoir une confirmation.'),
        },
        submitBtn:   s('Submit RSVP', 'Envoyer mon RSVP'),
        updateBtn:   s('Update RSVP', 'Mettre à jour mon RSVP'),
        successMsg:  s('RSVP submitted successfully.', 'RSVP envoyé avec succès.'),
        errorMsg:    s('We could not submit your RSVP. Please try again.', "Nous n'avons pas pu envoyer votre RSVP. Veuillez réessayer."),
        signedInAs:  s('Signed in as', 'Connecté en tant que'),
        canUpdate:   s('You can update your response anytime before the deadline.', 'Vous pouvez modifier votre réponse à tout moment avant la date limite.'),
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
    heroTitle:     s('Village de Sully', 'Village de Sully'),
    heroDate:      s('28–30 May 2027', '28–30 mai 2027'),
    heroEventType: s('A Weekend Celebration', 'Un week-end de célébration'),
    when: {
      heading: s('When', 'Quand'),
      dates:   s('Friday, May 28 – Sunday, May 30, 2027', 'Vendredi 28 mai – Dimanche 30 mai 2027'),
      desc:    s('Full weekend celebration', 'Week-end de célébration'),
    },
    where: {
      heading:       s('Where', 'Où'),
      venueLabel:    s('Venue', 'Lieu'),
      datesLabel:    s('Dates', 'Dates'),
      mapLabel:      s('Map', 'Carte'),
      venue:         s('Village De Sully', 'Village De Sully'),
      location:      s('Ile-de-France, near Paris', 'Île-de-France, près de Paris'),
      appleMapLink:  s('View on Apple Maps ↗', 'Voir sur Apple Plans ↗'),
      googleMapLink: s('View on Google Maps ↗', 'Voir sur Google Maps ↗'),
    },
    accommodation: {
      heading:         s('Accommodation', 'Hébergement'),
      stayAtVillage:   s('Stay onsite', 'Séjour au village'),
      price:           s('€75 per person, per night (double occupancy)', '75 € par personne et par nuit (occupation double)'),
      reserveNote:     s('Reserve through RSVP', 'Réservez via le RSVP'),
    },
    weekend: {
      friday: {
        day:          s('Friday', 'Vendredi'),
        timeEvening:  s('Evening', 'Soirée'),
        welcomeDinner: s('Welcome Dinner', 'Dîner de bienvenue'),
        welcomeDesc:  s('Casual gathering as guests arrive', "Retrouvailles informelles à l'arrivée des invités"),
      },
      saturday: {
        day:           s('Saturday', 'Samedi'),
        timeMorning:   s('Morning', 'Matin'),
        breakfast:     s('Breakfast', 'Petit-déj'),
        timeAfternoon: s('Afternoon', 'Après-midi'),
        ceremony:      s('Ceremony', 'Cérémonie'),
        cocktail:      s('Cocktail Hour', 'Cocktail'),
        timeEvening:   s('Evening', 'Soirée'),
        reception:     s('Reception & Dinner', 'Réception & Dîner'),
      },
      sunday: {
        day:           s('Sunday', 'Dimanche'),
        timeMorning:   s('Morning', 'Matin'),
        breakfast:     s('Breakfast', 'Petit-déj'),
        timeMidday:    s('Midday', 'Midi'),
        farewellBrunch: s('Farewell Brunch', "Brunch d'adieu"),
      },
    },
    location: {
      heading:        s('The Location', 'Le lieu'),
      mapPlaceholder: s('Interactive map showing Village de Sully and Paris will be added here', 'Une carte interactive montrant le Village de Sully et Paris sera ajoutée ici'),
      context:        s('Village de Sully is located in the Ile-de-France region, approximately 60km west of Paris.', "Le Village de Sully est situé en Île-de-France, à environ 60 km à l'ouest de Paris."),
    },
    calendar: {
      heading:         s('Save the Dates', 'Notez les dates'),
      subtext:         s('Add the full weekend to your calendar.', 'Ajoutez le week-end complet à votre agenda.'),
      addBtn:          s('Add to Calendar', "Ajouter à l'agenda"),
    },
    nav: {
      schedule: {
        title: s('Schedule', 'Programme'),
        desc:  s('Full weekend timeline', 'Programme du week-end complet'),
      },
      venue: {
        title: s('The Venue', 'Le Lieu'),
        desc:  s('Village De Sully & grounds', 'Village De Sully & domaine'),
      },
      couple: {
        title: s('The Couple', 'Le Couple'),
        desc:  s('Read our story', 'Lire notre histoire'),
      },
      travel: {
        title: s('Travel', 'Voyager'),
        desc:  s('Getting there & around', 'Comment venir & se déplacer'),
      },
      rsvp: {
        title: s('RSVP', 'RSVP'),
        desc:  s('Confirm & request accommodation', "Confirmer & réserver l'hébergement"),
      },
    },

    // /france/schedule
    schedule: {
      pageTitle:      s('France Schedule', 'Programme France'),
      heading:        s('Weekend Schedule', 'Programme du week-end'),
      subtitle:       s('May 28–30, 2027', '28–30 mai 2027'),
      checkin:        s('Check-in', 'Arrivée'),
      checkinValue:   s('Friday, 4:00 PM', 'Vendredi, 16h00'),
      checkout:       s('Check-out', 'Départ'),
      checkoutValue:  s('Sunday, 4:00 PM', 'Dimanche, 16h00'),
      calendarBtn:    s('Add Weekend to Calendar', "Ajouter le week-end à l'agenda"),
      calendarNote:   s("Personalized calendar with your RSVP'd events", 'Calendrier personnalisé avec vos événements RSVP'),
      friday: {
        heading: s('Friday, May 28', 'Vendredi 28 mai'),
        checkin: {
          time:  s('4:00 PM', '16h00'),
          title: s('Check-in Opens', 'Ouverture des arrivées'),
          desc:  s('Settle into your accommodations at the village', 'Installez-vous dans votre hébergement au village'),
        },
        dinner: {
          time:     s('7:00 PM', '19h00'),
          title:    s('Welcome Dinner', 'Dîner de bienvenue'),
          location: s('Village De Sully', 'Village De Sully'),
          desc:     s('Casual gathering to kick off the weekend', 'Retrouvailles informelles pour démarrer le week-end'),
        },
      },
      saturday: {
        heading: s('Saturday, May 29', 'Samedi 29 mai'),
        dayNote: s('Event Day', 'Jour principal'),
        breakfast: {
          time:  s('Morning', 'Matin'),
          title: s('Breakfast', 'Petit-déjeuner'),
          desc:  s('Included for overnight guests', 'Inclus pour les résidents'),
        },
        excursions: {
          time:        s('Late Morning', 'Fin de matinée'),
          title:       s('Optional Excursions', 'Excursions optionnelles'),
          placeholder: s('Details TBD', 'Détails à confirmer'),
        },
        ceremony: {
          time:     s('Afternoon', 'Après-midi'),
          title:    s('Ceremony', 'Cérémonie'),
          location: s('On the grounds', 'Dans le domaine'),
        },
        cocktail: {
          time:     s('Following', 'Ensuite'),
          title:    s('Cocktail Hour', 'Cocktail'),
          location: s('On the grounds', 'Dans le domaine'),
        },
        reception: {
          time:  s('Evening', 'Soirée'),
          title: s('Reception & Dinner', 'Réception & Dîner'),
          desc:  s('Dinner, toasts, and dancing into the night', "Dîner, discours et danse jusqu'au bout de la nuit"),
        },
      },
      sunday: {
        heading: s('Sunday, May 30', 'Dimanche 30 mai'),
        breakfast: {
          time:  s('Morning', 'Matin'),
          title: s('Breakfast', 'Petit-déjeuner'),
          desc:  s('Included for overnight guests', 'Inclus pour les résidents'),
        },
        brunch: {
          time:     s('11:00 AM', '11h00'),
          title:    s('Farewell Brunch', "Brunch d'adieu"),
          location: s('Village De Sully', 'Village De Sully'),
          desc:     s('Final gathering before departures', 'Dernier rassemblement avant les départs'),
        },
        checkout: {
          time:  s('4:00 PM', '16h00'),
          title: s('Check-out', 'Départ'),
          desc:  s('Please vacate rooms by this time', 'Merci de libérer vos chambres à cette heure'),
        },
      },
    },

    // /france/details
    details: {
      pageTitle: s('France Details', 'Détails France'),
      heading:   s('The Venue', 'Le Lieu'),
      subtitle:  s('Village De Sully', 'Village De Sully'),
      about: {
        heading:       s('About the Venue', 'À propos du lieu'),
        name:          s('Village De Sully', 'Village De Sully'),
        location:      s('Ile-de-France, approximately 60km west of Paris', "Île-de-France, à environ 60 km à l'ouest de Paris"),
        appleMapLink:  s('View on Apple Maps ↗', 'Voir sur Apple Plans ↗'),
        googleMapLink: s('View on Google Maps ↗', 'Voir sur Google Maps ↗'),
        websiteLink:   s('Venue Website ↗', 'Site du lieu ↗'),
        desc:          s(
          'A charming village property with beautiful grounds, perfect for a weekend celebration with family and friends.',
          'Un charmant domaine champêtre avec de beaux jardins, parfait pour un week-end de célébration en famille et entre amis.',
        ),
      },
      spaces: {
        heading: s('The Spaces', 'Les Espaces'),
        grounds: {
          title: s('The Grounds', 'Le Domaine'),
          desc:  s('Beautiful gardens and outdoor spaces for gathering throughout the weekend.', 'De beaux jardins et espaces extérieurs pour se retrouver tout au long du week-end.'),
        },
        ceremony: {
          title: s('Ceremony Space', 'Espace cérémonie'),
          desc:  s('An outdoor ceremony surrounded by nature on the village grounds.', 'Une cérémonie en plein air entourée par la nature dans le domaine.'),
        },
        accommodation: {
          title: s('Accommodations', 'Hébergements'),
          desc:  s('Comfortable guest rooms within the village property.', 'Des chambres confortables au sein du domaine.'),
        },
      },
      staying: {
        heading:            s('Staying at the Village', 'Séjourner au village'),
        recommendation:     s('We strongly recommend staying on-site.', 'Nous recommandons vivement de séjourner sur place.'),
        recommendationNote: s(
          'The village is in a rural area with very limited nearby hotel options. Staying on-site means you can fully enjoy the weekend without worrying about transportation.',
          "Le village est en zone rurale avec très peu d'hôtels à proximité. Séjourner sur place vous permet de profiter pleinement du week-end sans vous soucier des déplacements.",
        ),
        roomDetails: {
          heading:     s('Room Details', 'Détails des chambres'),
          price:       s('€75 per person, per night', '75 € par personne par nuit'),
          breakfast:   s('Breakfast included each morning', 'Petit-déjeuner inclus chaque matin'),
          checkin:     s('Check-in: Friday, 4:00 PM', 'Arrivée : vendredi à 16h00'),
          checkout:    s('Check-out: Sunday, 4:00 PM', 'Départ : dimanche à 16h00'),
          bookingNote: s(
            "Reserve your room through the RSVP form. We'll confirm your booking closer to the event.",
            "Réservez votre chambre via le formulaire RSVP. Nous confirmerons votre réservation à l'approche de l'événement.",
          ),
        },
        rsvpDeadline: {
          heading: s('RSVP', 'RSVP'),
          value:   { en: `By ${RSVP_DEADLINE_FRANCE.en}`, fr: `Avant le ${RSVP_DEADLINE_FRANCE.fr}` },
        },
      },
      dressCode: {
        heading: s('Dress Code', 'Code vestimentaire'),
        friday: {
          event: s('Friday Welcome Dinner', 'Dîner de bienvenue du vendredi'),
          code:  s('Smart Casual', 'Smart Casual'),
        },
        saturday: {
          event: s('Saturday Ceremony & Reception', 'Cérémonie & réception du samedi'),
          code:  s('Garden Party Attire', 'Tenue de garden party'),
          note:  s(
            'The ceremony is outdoors — comfortable shoes recommended for grass and garden paths.',
            "La cérémonie est en extérieur — chaussures confortables recommandées pour marcher sur l'herbe et les allées du jardin.",
          ),
        },
        sunday: {
          event: s('Sunday Brunch', 'Brunch du dimanche'),
          code:  s('Casual', 'Décontracté'),
        },
      },
    },

    // /france/travel
    travel: {
      pageTitle: s('France Travel', 'Voyager en France'),
      heading:   s('Travel', 'Voyager'),
      subtitle:  s('Getting to Village De Sully', 'Comment se rendre au Village De Sully'),
      toFrance: {
        heading: s('Getting to France', 'Comment venir en France'),
        note:    s('For guests traveling from abroad.', "Pour les invités venant de l'étranger."),
        air: {
          heading: s('By Air', 'En avion'),
          intro:   s('Paris has two major international airports:', 'Paris possède deux grands aéroports internationaux :'),
          cdg:     s(
            'Paris CDG (Charles de Gaulle) — Most international flights arrive here. Well connected to central Paris via RER B train (~35 min).',
            "Paris CDG (Charles de Gaulle) — La plupart des vols internationaux y arrivent. Bien connecté au centre de Paris via le RER B (~35 min).",
          ),
          orly:    s(
            'Paris Orly — Closer to the city center, serves European and some international flights. Orlyval + RER B or Tram T7 to reach Paris.',
            "Paris Orly — Plus proche du centre-ville, dessert les vols européens et certains vols internationaux. Orlyval + RER B ou Tram T7 pour rejoindre Paris.",
          ),
        },
        eurostar: {
          heading: s('By Train (Eurostar)', 'En train (Eurostar)'),
          text:    s(
            'From London, the Eurostar runs to Paris Gare du Nord in ~2h15. Book early for the best fares.',
            "Au départ de Londres, l'Eurostar rejoint Paris Gare du Nord en ~2h15. Réservez tôt pour les meilleurs tarifs.",
          ),
        },
      },
      toVenue: {
        heading: s('Getting to the Venue from Paris', 'Comment se rendre au lieu depuis Paris'),
        intro:   s('Village De Sully is in the Ile-de-France region, approximately 60km west of Paris.', "Le Village De Sully est en Île-de-France, à environ 60 km à l'ouest de Paris."),
        train: {
          heading: s('By Train', 'En train'),
          step1:   s(
            'Take a Transilien train (Line J or N) from Paris Saint-Lazare to Mantes-la-Jolie station (~45 min)',
            "Prenez un train Transilien (ligne J ou N) depuis Paris Saint-Lazare jusqu'à la gare de Mantes-la-Jolie (~45 min)",
          ),
          step2:   s(
            'From Mantes-la-Jolie, the venue is a short drive (~15 min)',
            'Depuis Mantes-la-Jolie, le lieu est à une courte distance en voiture (~15 min)',
          ),
          note:    s(
            'Ubers are available around Mantes-la-Jolie station. Taxis are right in front of the station.',
            "Des Uber sont disponibles autour de la gare de Mantes-la-Jolie. Des taxis sont juste devant la gare.",
          ),
        },
        car: {
          heading:     s('By Car', 'En voiture'),
          text:        s('From central Paris: ~1 hour via the A13 motorway. Free parking available at the village.', "Depuis le centre de Paris : ~1 heure via l'autoroute A13. Parking gratuit disponible au village."),
          placeholder: s('Detailed driving directions will be provided closer to the event.', "Des instructions détaillées seront fournies à l'approche de l'événement."),
        },
      },
      practical: {
        heading: s('Practical Info', 'Informations pratiques'),
        dateRef: s('For the weekend of May 28–30, 2027:', 'Pour le week-end du 28–30 mai 2027 :'),
        timezone: {
          heading: s('Time Zone', 'Fuseau horaire'),
          value:   s('CEST (UTC+2)', 'CEST (UTC+2)'),
          note:    s('6 hours ahead of New York', "6 heures d'avance sur New York"),
        },
        currency: {
          heading: s('Currency', 'Monnaie'),
          value:   s('Euro (€)', 'Euro (€)'),
          note:    s('Cards widely accepted; some small shops prefer cash', 'Cartes bancaires largement acceptées ; certains petits commerces préfèrent le liquide'),
        },
        language: {
          heading: s('Language', 'Langue'),
          value:   s('French', 'Français'),
          note:    s("English understood in Paris and tourist areas", "L'anglais est compris à Paris et dans les zones touristiques"),
        },
        weather: {
          heading: s('Weather', 'Météo'),
          value:   s('Late May', 'Fin mai'),
          note:    s('Typically 15–22°C (60–72°F), pleasant and sunny. Light layers recommended for evenings.', 'Généralement 15–22°C, agréable et ensoleillé. Des couches légères sont recommandées pour les soirées.'),
        },
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
        prefix: s('We already have your RSVP. Last saved', 'Nous avons déjà votre RSVP. Dernière sauvegarde le'),
        suffix: s('You can update and submit again anytime.', 'Vous pouvez le modifier et le soumettre à nouveau à tout moment.'),
      },
      confirmation: {
        pageTitle:    s('France RSVP Confirmation', 'Confirmation RSVP France'),
        heading:      s('RSVP Saved', 'RSVP enregistré'),
        subtitle:     s('Here is your latest response for France.', 'Voici votre dernière réponse pour la France.'),
        savedLabel:   s('Last updated', 'Dernière mise à jour'),
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
          note:    s('These events are part of your invitation.', 'Ces événements font partie de votre invitation.'),
          empty:   s('No core events are assigned to this invitation yet.', "Aucun événement principal n'est encore assigné à cette invitation."),
        },
        optionalEvents: {
          heading: s('Special Activities', 'Activités spéciales'),
          note:    s("Choose any extra celebrations you'd like to attend.", 'Choisissez les célébrations supplémentaires auxquelles vous souhaitez participer.'),
          empty:   s('No optional events are assigned right now.', "Aucun événement optionnel n'est assigné pour le moment."),
        },
        dietary: {
          heading:     s('Dietary Needs & Allergens', 'Besoins alimentaires & allergènes'),
          note:        s('Share any allergies or dietary requirements.', 'Indiquez vos allergies ou régimes alimentaires.'),
          placeholder: s('List allergens or dietary restrictions', 'Listez les allergènes ou restrictions alimentaires'),
        },
        accommodation: {
          heading: s('Accommodation', 'Hébergement'),
          note:    s('Request accommodation at Village De Sully.', 'Demandez un hébergement au Village De Sully.'),
          unsure:  s('Not sure yet', 'Pas encore sûr(e)'),
          yes:     s('Yes, please include me', 'Oui, incluez-moi'),
          no:      s('No, I do not need accommodation', "Non, je n'ai pas besoin d'hébergement"),
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
          placeholder: s('Share your well wishes or anything else we should know', 'Partagez vos vœux ou tout ce que nous devrions savoir'),
        },
        email: {
          heading:          s('Confirmation Email', 'Email de confirmation'),
          label:            s('Email address', 'Adresse email'),
          optional:         s('(optional)', '(facultatif)'),
          placeholder:      s('you@example.com', 'vous@exemple.com'),
          sendConfirmation: s('Send me an email confirmation', "M'envoyer une confirmation par email"),
          note:             s('Everyone below with an email address will receive the confirmation.', 'Chaque personne ci-dessous avec une adresse email recevra la confirmation.'),
          requireOne:       s('Add at least one email address to receive a confirmation.', 'Ajoutez au moins une adresse email pour recevoir une confirmation.'),
        },
        submitBtn:  s('Submit RSVP', 'Envoyer mon RSVP'),
        updateBtn:  s('Update RSVP', 'Mettre à jour mon RSVP'),
        successMsg: s('RSVP submitted successfully.', 'RSVP envoyé avec succès.'),
        errorMsg:   s('We could not submit your RSVP. Please try again.', "Nous n'avons pas pu envoyer votre RSVP. Veuillez réessayer."),
        signedInAs: s('Signed in as', 'Connecté en tant que'),
        canUpdate:  s('You can update your response anytime before the deadline.', 'Vous pouvez modifier votre réponse à tout moment avant la date limite.'),
      },
    },
  },

  // ─────────────────────────────────────────
  // Registry
  // ─────────────────────────────────────────
  registry: {
    pageTitle: s('Registry', 'Liste de mariage'),
    heading:   s('Registry', 'Liste de mariage'),
  },
};
