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

export const strings = {
  // ─────────────────────────────────────────
  // Global — shared across all pages
  // ─────────────────────────────────────────
  global: {
    siteName:     s('Chez Sargaux', 'Chez Sargaux'),
    rsvpBtn:      s('RSVP', 'RSVP'),
    registry:     s('Registry', 'Liste de mariage'),
    logout:       s('Logout', 'Se déconnecter'),
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
    backToNyc:    s('← Back to NYC', '← Retour à New York'),
    backToFrance: s('← Back to France', '← Retour à la France'),
  },

  // ─────────────────────────────────────────
  // Homepage
  // ─────────────────────────────────────────
  home: {
    pageTitle:  s('Homepage', 'Accueil'),
    heroTitle:  s('Chez Sargaux', 'Chez Sargaux'),
    tagline:    s('Sam & Margaux', 'Sam & Margaux'),
    ctaEnter:   s('Entrée', 'Entrée'),
    modal: {
      title:        s('Welcome', 'Bienvenue'),
      subtitle:     s('Please enter your name to continue', 'Veuillez entrer votre nom pour continuer'),
      nameLabel:    s('Your name', 'Votre nom'),
      namePlaceholder: s('Sam Gross', 'Margaux Ancel'),
      submitBtn:    s('Continuer', 'Continuer'),
      checkingBtn:  s('Checking...', 'Vérification...'),
      errorEmpty:   s('Please enter your name', 'Veuillez entrer votre nom'),
      errorDefault: s('Something went wrong. Please try again.', 'Une erreur est survenue. Veuillez réessayer.'),
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
    when: {
      heading:  s('When', 'Quand'),
      date:     s('Sunday, October 11, 2026', 'Dimanche 11 octobre 2026'),
      weekend:  s('', ''),
      note:     s('', ''),
    },
    where: {
      heading:    s('Where', 'Où'),
      dinner:     s('Bar Blondeau', 'Bar Blondeau'),
      dinnerType: s('Cocktails & Dinner', 'Cocktail & Dîner'),
      separator:  s('followed by', 'suivi de'),
      dancing:    s('Dancing Venue TBD', 'Lieu du dancing à confirmer'),
    },
    dressCode: {
      heading: s('Dress Code', 'Code vestimentaire'),
      value:   s('Festive Attire', 'Tenue de fête'),
      note:    s('Think jackets but no tie required.', 'Veste recommandée, cravate non obligatoire.'),
    },
    calendar: {
      heading:         s('Save the Date', 'Notez la date'),
      subtext:         s("Add the events to your calendar app.", "Ajoutez notre événement à votre agenda pour ne rien manquer."),
      addBtn:          s('Add to Calendar', "Ajouter à l'agenda"),
      unavailableNote: s('Your personalized calendar link will be available after you RSVP.', 'Lien de calendrier personnalisé disponible après votre RSVP'),
    },
    nav: {
      details: {
        title: s('Details', 'Détails'),
        desc:  s('Venues & what to expect', 'Lieux & programme'),
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
          time:  s('5:00 PM', '17h00'),
          title: s('Cocktails & Dinner', 'Cocktail & Dîner'),
          desc:  s('Join us for an evening of celebration', 'Rejoignez-nous pour une soirée de célébration'),
        },
        dancing: {
          time:  s('9:00 PM', '21h00'),
          title: s('Dancing', 'Dancing'),
          desc:  s('Continue the celebration with us later in the evening', 'Continuez la fête dans notre second lieu'),
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
          name:           s('Venue TBD', 'Lieu à confirmer'),
          mapPlaceholder: s('Map will be added here', 'La carte sera ajoutée ici'),
        },
      },
      whatToExpect: {
        heading: s('What to Expect', 'Programme de la soirée'),
        text:    s(
          "The evening will begin with dinner and cocktails at Bar Blondeau. Later, we'll move to a second location for dancing and continued celebration.",
          "La soirée commencera par un cocktail et un dîner debout dans notre premier lieu. Ensuite, nous nous retrouverons dans un second endroit pour danser et continuer la fête.",
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
        hotel1:     s('Wythe Hotel — We have a limited number of rooms available at a special rate for our guests.', 'Hôtel à confirmer — Près du lieu du dîner'),
        hotel2:     s('Hotel TBD — Near dancing venue', 'Hôtel à confirmer — Près du lieu du dancing'),
        hotel3:     s('Budget Option TBD — Nearby neighborhood', 'Option économique à confirmer — Quartier proche'),
        roomBlock:  s('Room block details coming soon', 'Détails du bloc de chambres à venir'),
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
          heading: s('By Subway', 'En métro'),
          intro:   s('Take the L train to Bedford Avenue — a 5-minute walk to the venue.', "Prenez la ligne L jusqu'à Bedford Avenue — à 5 minutes à pied du lieu."),
          fare:    s('Single ride: $3 (set up Express Transit on your phone ahead of time)', "Trajet simple : 3 $ (configurez le transit express sur votre téléphone à l'avance)"),
          maps:    s('Google Maps and Apple Maps have great subway directions', "Google Maps et Apple Plans proposent d'excellents itinéraires en métro"),
        },
        parking: {
          heading: s('Parking', 'Parking'),
          text:    s('Parking is available one block away at 25 Kent.', "Un parking est disponible à un pâté de maisons au 25 Kent Ave."),
        },
      },
      whileHere: {
        heading: s("While You're Here", 'À ne pas manquer'),
        intro:   s("October is a wonderful time to explore NYC's world-class museums and exhibitions:", "Octobre est une période idéale pour découvrir les musées et expositions de classe mondiale de New York :"),
        museums: {
          heading:       s('Museums', 'Musées'),
          met:           s('The Met — Fifth Avenue, suggested donation admission', 'Le Met — Cinquième Avenue, entrée aux dons suggérés'),
          moma:          s('MoMA — Midtown, modern & contemporary art', 'MoMA — Midtown, art moderne et contemporain'),
          whitney:       s('Whitney — Meatpacking District, American art', 'Whitney — Meatpacking District, art américain'),
          naturalHistory: s('Natural History — Upper West Side, great for all ages', 'Histoire naturelle — Upper West Side, pour tous les âges'),
          guggenheim:    s('Guggenheim — Upper East Side, iconic architecture', 'Guggenheim — Upper East Side, architecture iconique'),
        },
        exhibitions: {
          heading:     s('Exhibitions & Experiences', 'Expositions & Expériences'),
          placeholder: s("Current exhibitions for October 2026 TBD — check museum websites closer to date", "Expositions en octobre 2026 à confirmer — consultez les sites des musées à l'approche de la date"),
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
      deadlineDate:      s('September 1, 2026', '1er septembre 2026'),
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
      form: {
        whosComing: {
          heading: s("Who's Coming?", 'Qui vient ?'),
          note:    s("Toggle each guest's attendance and edit names if needed.", 'Indiquez la présence de chaque invité et modifiez les noms si nécessaire.'),
        },
        coreEvents: {
          heading: s('Core Events', 'Événements principaux'),
          note:    s('These events are part of your invitation.', 'Ces événements font partie de votre invitation.'),
          empty:   s('No core events are assigned to this invitation yet.', "Aucun événement principal n'est encore assigné à cette invitation."),
        },
        optionalEvents: {
          heading: s('Optional Events', 'Événements optionnels'),
          note:    s("Choose any extra celebrations you'd like to attend.", 'Choisissez les célébrations supplémentaires auxquelles vous souhaitez participer.'),
          empty:   s('No optional events are assigned right now.', "Aucun événement optionnel n'est assigné pour le moment."),
        },
        dietary: {
          heading:     s('Dietary Restrictions', 'Restrictions alimentaires'),
          note:        s('Let us know about allergies or dietary preferences.', 'Indiquez-nous vos allergies ou préférences alimentaires.'),
          placeholder: s('e.g., Vegetarian, nut allergy, gluten-free', 'ex. : Végétarien, allergie aux noix, sans gluten'),
        },
        songRequest: {
          heading:     s('Song Request', 'Demande de chanson'),
          note:        s('What should we play to get you dancing?', 'Quelle chanson vous ferait danser ?'),
          placeholder: s('Artist — Song', 'Artiste — Chanson'),
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
    heroTitle:     s('France', 'France'),
    heroDate:      s('May 28–30, 2027', '28–30 mai 2027'),
    heroEventType: s('Weekend Celebration at Village De Sully', 'Week-end de célébration au Village De Sully'),
    when: {
      heading: s('When', 'Quand'),
      dates:   s('Friday, May 28 – Sunday, May 30, 2027', 'Vendredi 28 mai – Dimanche 30 mai 2027'),
      desc:    s('Full weekend celebration', 'Week-end de célébration'),
    },
    where: {
      heading:  s('Where', 'Où'),
      venue:    s('Village De Sully', 'Village De Sully'),
      location: s('Ile-de-France, near Paris', 'Île-de-France, près de Paris'),
      mapLink:  s('View on Map ↗', 'Voir sur la carte ↗'),
    },
    accommodation: {
      heading:         s('Accommodation', 'Hébergement'),
      stayAtVillage:   s('Stay at the village', 'Séjour au village'),
      price:           s('€75/night (breakfast included)', '75 €/nuit (petit-déjeuner inclus)'),
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
        breakfast:     s('Breakfast for overnight guests', 'Petit-déjeuner pour les résidents'),
        timeAfternoon: s('Afternoon', 'Après-midi'),
        ceremony:      s('Ceremony', 'Cérémonie'),
        cocktail:      s('Cocktail Hour', 'Cocktail'),
        timeEvening:   s('Evening', 'Soirée'),
        reception:     s('Reception & Dinner', 'Réception & Dîner'),
      },
      sunday: {
        day:           s('Sunday', 'Dimanche'),
        timeMorning:   s('Morning', 'Matin'),
        breakfast:     s('Breakfast for overnight guests', 'Petit-déjeuner pour les résidents'),
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
      unavailableNote: s('Personalized calendar link available after RSVP', 'Lien de calendrier personnalisé disponible après votre RSVP'),
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
        heading:     s('About the Venue', 'À propos du lieu'),
        name:        s('Village De Sully', 'Village De Sully'),
        location:    s('Ile-de-France, approximately 60km west of Paris', "Île-de-France, à environ 60 km à l'ouest de Paris"),
        mapLink:     s('View on Google Maps ↗', 'Voir sur Google Maps ↗'),
        websiteLink: s('Venue Website ↗', 'Site du lieu ↗'),
        desc:        s(
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
      deadlineDate: s('March 15, 2027', '15 mars 2027'),
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
      form: {
        whosComing: {
          heading: s("Who's Coming?", 'Qui vient ?'),
          note:    s("Toggle each guest's attendance and edit names if needed.", 'Indiquez la présence de chaque invité et modifiez les noms si nécessaire.'),
        },
        coreEvents: {
          heading: s('Core Events', 'Événements principaux'),
          note:    s('These events are part of your invitation.', 'Ces événements font partie de votre invitation.'),
          empty:   s('No core events are assigned to this invitation yet.', "Aucun événement principal n'est encore assigné à cette invitation."),
        },
        optionalEvents: {
          heading: s('Optional Events', 'Événements optionnels'),
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
