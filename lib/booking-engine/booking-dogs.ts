export type BookingDogDetails = {
  id: string;
  owner_id: string;
  name: string;
  breed: string | null;
  active: boolean;
  vaccinated: boolean | null;
  vaccination_expiry: string | null;
  meet_and_greet_completed: boolean | null;
  can_share_with_other_dogs: boolean;
};

export type BookingDogLinkRecord = {
  dog_id: string;
  sort_order: number;
};

export type BookingDogValidationResult =
  | {
      valid: true;
      dogs: BookingDogDetails[];
      primaryDog: BookingDogDetails;
      dogNames: string[];
      allDogsCanShare: boolean;
    }
  | {
      valid: false;
      error: string;
    };

function getDogName(dog: BookingDogDetails) {
  return dog.name.trim() || "A selected dog";
}

export function orderBookingDogs({
  dogs,
  bookingDogLinks,
}: {
  dogs: BookingDogDetails[];
  bookingDogLinks: BookingDogLinkRecord[];
}) {
  const dogById = new Map(dogs.map((dog) => [dog.id, dog]));

  return [...bookingDogLinks]
    .sort(
      (firstLink, secondLink) => firstLink.sort_order - secondLink.sort_order,
    )
    .map((bookingDogLink) => dogById.get(bookingDogLink.dog_id))
    .filter((dog): dog is BookingDogDetails => Boolean(dog));
}

export function validateDogsForBookingConfirmation({
  ownerId,
  bookingStartDate,
  dogs,
  bookingDogLinks,
}: {
  ownerId: string;
  bookingStartDate: string;
  dogs: BookingDogDetails[];
  bookingDogLinks: BookingDogLinkRecord[];
}): BookingDogValidationResult {
  if (bookingDogLinks.length === 0) {
    return {
      valid: false,
      error: "The booking does not contain any linked dogs.",
    };
  }

  const uniqueDogIds = new Set(
    bookingDogLinks.map((bookingDogLink) => bookingDogLink.dog_id),
  );

  if (uniqueDogIds.size !== bookingDogLinks.length) {
    return {
      valid: false,
      error: "The booking contains the same dog more than once.",
    };
  }

  const orderedDogs = orderBookingDogs({
    dogs,
    bookingDogLinks,
  });

  if (orderedDogs.length !== bookingDogLinks.length) {
    return {
      valid: false,
      error: "One or more dogs linked to the booking could not be found.",
    };
  }

  for (const dog of orderedDogs) {
    const dogName = getDogName(dog);

    if (dog.owner_id !== ownerId) {
      return {
        valid: false,
        error: `${dogName} does not belong to the booking customer.`,
      };
    }

    if (!dog.active) {
      return {
        valid: false,
        error: `${dogName} is inactive and cannot be included in a confirmed booking.`,
      };
    }

    if (!dog.vaccinated) {
      return {
        valid: false,
        error: `${dogName}'s vaccination information is incomplete.`,
      };
    }

    if (!dog.vaccination_expiry) {
      return {
        valid: false,
        error: `${dogName}'s vaccination expiry date is missing.`,
      };
    }

    if (dog.vaccination_expiry < bookingStartDate) {
      return {
        valid: false,
        error: `${dogName}'s vaccination will have expired before the booking begins.`,
      };
    }
  }

  return {
    valid: true,
    dogs: orderedDogs,
    primaryDog: orderedDogs[0],
    dogNames: orderedDogs.map((dog) => getDogName(dog)),
    allDogsCanShare: orderedDogs.every((dog) => dog.can_share_with_other_dogs),
  };
}

export function formatBookingDogNames(dogs: BookingDogDetails[]) {
  const dogNames = dogs.map((dog) => getDogName(dog)).filter(Boolean);

  if (dogNames.length === 0) {
    return "Dog";
  }

  if (dogNames.length === 1) {
    return dogNames[0];
  }

  if (dogNames.length === 2) {
    return `${dogNames[0]} and ${dogNames[1]}`;
  }

  return `${dogNames.slice(0, -1).join(", ")} and ${dogNames.at(-1)}`;
}

export function formatBookingDogBreeds(dogs: BookingDogDetails[]) {
  const breeds = dogs.map((dog) => dog.breed?.trim() || "").filter(Boolean);

  if (breeds.length === 0) {
    return null;
  }

  return breeds.join(", ");
}
