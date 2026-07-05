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

/** RSVP deadline dates — single source of truth for each event */
export const RSVP_DEADLINE_NYC    = { en: 'September 1, 2026',  fr: '1er septembre 2026' } satisfies T;
export const RSVP_DEADLINE_FRANCE = { en: 'April 15, 2027',     fr: '15 avril 2027'      } satisfies T;
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
    explore:      s('Explore', 'Navigation'),
    copyright:    s('© 2026 Sam Gross', '© 2026 Sam Gross'),
    detailsToCome: s('Details to come', 'Détails à venir'),
    attending:    s('Attending', 'Présent'),
    notAttending: s('Not attending', 'Absent'),
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
      programme: s('Programme of Events', 'Programme des événements'),
      details:   s('The Details', 'Les détails'),
    },
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
      location:      s('Île-de-France, near Paris', 'Île-de-France, près de Paris'),
      appleMapLink:  s('View on Apple Maps ↗', 'Voir sur Apple Plans ↗'),
      googleMapLink: s('View on Google Maps ↗', 'Voir sur Google Maps ↗'),
    },
    accommodation: {
      heading:         s('Stay', 'Hébergement'),
      stayAtVillage:   s('Rooms at the venue', 'Séjour au village'),
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
      context:        s('Village de Sully is located in the Île-de-France region, approximately 60km west of Paris.', "Le Village de Sully est situé en Île-de-France, à environ 60 km à l'ouest de Paris."),
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
      lookbook: {
        title: s('Lookbook', 'Lookbook'),
        desc:  s('Outfit inspiration & ideas', 'Inspiration tenues & idées'),
      },
      rsvp: {
        title: s('RSVP', 'RSVP'),
        desc:  s('Confirm & request accommodation', "Confirmer & réserver l'hébergement"),
      },
    },

    // /france/lookbook
    lookbook: {
      pageTitle: s('France Lookbook', 'Lookbook France'),
      heading:   s('Lookbook', 'Lookbook'),
      subtitle:  s('Outfit inspiration & ideas', 'Inspiration tenues & idées'),
    },

    // /france/schedule
    schedule: {
      pageTitle:      s('France Schedule', 'Programme France'),
      heading:        s('Weekend Schedule', 'Programme du week-end'),
      subtitle:       s('May 28–30, 2027', '28–30 mai 2027'),
      checkin:        s('Check-in', 'Arrivée'),
      checkinValue:   s('Friday, 5:00 PM', 'Vendredi, 17h00'),
      checkout:       s('Check-out', 'Départ'),
      checkoutValue:  s('Sunday, 3:00 PM', 'Dimanche, 15h00'),
      calendarBtn:    s('Add Weekend to Calendar', "Ajouter le week-end à l'agenda"),
      calendarNote:   s("Personalized calendar with your RSVP'd events", 'Calendrier personnalisé avec vos événements RSVP'),
      friday: {
        heading: s('Friday, May 28', 'Vendredi 28 mai'),
        checkin: {
          time:  s('5:00 PM', '17h00'),
          title: s('Check-in Opens', 'Ouverture des arrivées'),
          desc:  s('Settle into your accommodations at the village', 'Installez-vous dans votre hébergement au village'),
        },
        dinner: {
          time:     s('7:00 PM', '19h00'),
          title:    s('Welcome Dinner', 'Dîner de bienvenue'),
          location: s('Village Square', 'Village Square'),
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
          title:       s('Optional Excursion', 'Excursions optionnelles'),
          placeholder: s('An adventure to Giverny', 'Détails à confirmer'),
        },
        ceremony: {
          time:     s('5:30 PM', '17h30'),
          title:    s('Ceremony', 'Cérémonie'),
          location: s('La Mairie', 'La Mairie'),
        },
        cocktail: {
          time:     s('Following', 'Ensuite'),
          title:    s('Cocktail Hour', 'Cocktail'),
          location: s('Village Square', 'Village Square'),
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
          location: s('Village Square', 'Village Square'),
          desc:     s('Village Square', 'Village Square'),
        },
        checkout: {
          time:  s('3:00 PM', '15h00'),
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
        location:      s('Île-de-France, approximately 60km west of Paris', "Île-de-France, à environ 60 km à l'ouest de Paris"),
        appleMapLink:  s('View on Apple Maps ↗', 'Voir sur Apple Plans ↗'),
        googleMapLink: s('View on Google Maps ↗', 'Voir sur Google Maps ↗'),
        websiteLink:   s('Venue Website ↗', 'Site du lieu ↗'),
        desc:          s(
          'Clos de Malassis was a small farming village that appeared on the first map of France, published in 1744. Now restored as an event space, Le Village de Sully offers a charming, throwback atmosphere nestled in the French countryside.',
          'Un charmant domaine champêtre avec de beaux jardins, parfait pour un week-end de célébration en famille et entre amis.',
        ),
      },
      spaces: {
        heading: s('The Spaces', 'Les Espaces'),
        grounds: {
          title: s('The Grounds', 'Le Domaine'),
          desc:  s('A reproduction of a village square, with indoor and outdoor spaces for gathering, socializing, and celebrating', 'De beaux jardins et espaces extérieurs pour se retrouver tout au long du week-end.'),
        },
        ceremony: {
          title: s('Ceremony Space', 'Espace cérémonie'),
          desc:  s('An outdoor, paved space for our ceremony with seating for all guests.', 'Une cérémonie en plein air entourée par la nature dans le domaine.'),
        },
        accommodation: {
          title: s('Accommodations', 'Hébergements'),
          desc:  s('Comfortable guest rooms with ensuite bathrooms and a variety of sleeping arrangements', 'Des chambres confortables au sein du domaine.'),
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
          checkin:     s('Check-in: Friday, 5:00 PM', 'Arrivée : vendredi à 17h00'),
          checkout:    s('Check-out: Sunday, 3:00 PM', 'Départ : dimanche à 15h00'),
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
          code:  s('Garden Party', 'Smart Casual'),
          note:  s(
            'The dinner will be outdoors on the village square, which is paved. Guests should expect some walking and standing, though seating will be available.',
            '',
          ),
        },
        saturday: {
          event: s('Saturday Ceremony & Reception', 'Cérémonie & réception du samedi'),
          code:  s('Cocktail Attire', 'Tenue de garden party'),
          note:  s(
            'The outdoor ceremony will be on paved ground. No worries about sharp heels or grass.',
            "La cérémonie est en extérieur — chaussures confortables recommandées pour marcher sur l'herbe et les allées du jardin.",
          ),
        },
        sunday: {
          event: s('Sunday Brunch', 'Brunch du dimanche'),
          code:  s('Very Casual', 'Décontracté'),
          note:  s('Street clothes for relaxing.', ''),
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
        intro:   s('Village De Sully is in the Île-de-France region, approximately 60km west of Paris.', "Le Village De Sully est en Île-de-France, à environ 60 km à l'ouest de Paris."),
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
        },
        car: {
          heading:              s('By Car', 'En voiture'),
          text:                 s('From central Paris: ~1 hour via the A13 motorway. Free parking available at the village.', "Depuis le centre de Paris : ~1 heure via l'autoroute A13. Parking gratuit disponible au village."),
          directionsBeforeLink: s('Driving directions are available', 'Les indications routières sont disponibles'),
          directionsLinkText:   s('here', 'ici'),
          directionsAfterLink:  s('.', '.'),
          tolls:                s('French highways use automated tolling and have frequent speed cameras.', 'Les autoroutes françaises utilisent un péage automatisé et comportent de nombreux radars.'),
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
          note:    s('Tap-to-pay and chip cards are widely accepted but swipes are not. Cash is rarely required and usually only used for transactions less than €10-20. American Express is usually only accepted at large chains, tourist attractions, and luxury retailers.', 'Les cartes sans contact et à puce sont largement acceptées, mais pas le glissement. Les espèces sont rarement nécessaires et généralement utilisées uniquement pour les transactions inférieures à 10-20 €. American Express est généralement accepté uniquement dans les grandes chaînes, les attractions touristiques et les commerces de luxe.'),
        },
        language: {
          heading: s('Language', 'Langue'),
          value:   s('French', 'Français'),
          note:    s('English is widely understood but outside of Paris and tourist areas people will strongly prefer French.', "L'anglais est largement compris, mais en dehors de Paris et des zones touristiques, les gens préféreront nettement le français."),
        },
        weather: {
          heading: s('Weather', 'Météo'),
          value:   s('Late May: 60–72°F (15–22°C)', 'Fin mai : 15–22°C (60–72°F)'),
          note:    s('Spring weather varies widely and changes quickly. Layers are recommended to deal with the evening chill.', "Le temps printanier varie beaucoup et change vite. Des couches sont recommandées pour faire face à la fraîcheur du soir."),
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
        submitBtn:  s('Submit RSVP', 'Confirmer ma présence'),
        updateBtn:  s('Update RSVP', 'Mettre à jour mon RSVP'),
        successMsg: s('RSVP submitted successfully.', 'RSVP envoyé avec succès.'),
        errorMsg:   s('We could not submit your RSVP. Please try again.', "Nous n'avons pas pu envoyer votre RSVP. Veuillez réessayer."),
        signedInAs: s('Signed in as', 'Vous répondez en tant que'),
        canUpdate:  { en: 'You can update your response anytime before the deadline.', fr: `Vous pourrez modifier votre réponse à tout moment jusqu'au ${RSVP_DEADLINE_FRANCE.fr}.` },
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
