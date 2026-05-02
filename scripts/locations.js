// Curated list of countries and major cities for the settings dropdown.
// Names match what the Aladhan timingsByCity endpoint accepts.
// Sorted alphabetically by country.

export const COUNTRIES = [
    { name: "Afghanistan", cities: ["Kabul", "Kandahar", "Herat", "Mazar-i-Sharif", "Jalalabad"] },
    { name: "Albania", cities: ["Tirana", "Durres", "Shkoder", "Vlore"] },
    { name: "Algeria", cities: ["Algiers", "Oran", "Constantine", "Annaba", "Blida"] },
    { name: "Australia", cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"] },
    { name: "Azerbaijan", cities: ["Baku", "Ganja", "Sumqayit"] },
    { name: "Bahrain", cities: ["Manama", "Muharraq", "Riffa", "Hamad Town"] },
    { name: "Bangladesh", cities: ["Dhaka", "Chittagong", "Sylhet", "Khulna", "Rajshahi"] },
    { name: "Belgium", cities: ["Brussels", "Antwerp", "Ghent", "Liege"] },
    { name: "Bosnia and Herzegovina", cities: ["Sarajevo", "Mostar", "Tuzla", "Banja Luka"] },
    { name: "Canada", cities: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa", "Edmonton"] },
    { name: "China", cities: ["Beijing", "Shanghai", "Urumqi", "Kashgar"] },
    { name: "Egypt", cities: ["Cairo", "Alexandria", "Giza", "Luxor", "Aswan", "Sharm El Sheikh", "Hurghada", "Mansoura", "Tanta", "Port Said", "Suez"] },
    { name: "France", cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Lille", "Nice", "Strasbourg"] },
    { name: "Germany", cities: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart"] },
    { name: "India", cities: ["Mumbai", "Delhi", "Hyderabad", "Bangalore", "Lucknow", "Kolkata", "Chennai"] },
    { name: "Indonesia", cities: ["Jakarta", "Surabaya", "Bandung", "Medan", "Yogyakarta", "Makassar"] },
    { name: "Iran", cities: ["Tehran", "Mashhad", "Isfahan", "Shiraz", "Tabriz", "Qom"] },
    { name: "Iraq", cities: ["Baghdad", "Basra", "Mosul", "Erbil", "Najaf", "Karbala"] },
    { name: "Italy", cities: ["Rome", "Milan", "Naples", "Turin"] },
    { name: "Jordan", cities: ["Amman", "Zarqa", "Irbid", "Aqaba"] },
    { name: "Kazakhstan", cities: ["Astana", "Almaty", "Shymkent"] },
    { name: "Kuwait", cities: ["Kuwait City", "Hawalli", "Salmiya", "Jahra"] },
    { name: "Lebanon", cities: ["Beirut", "Tripoli", "Sidon", "Tyre"] },
    { name: "Libya", cities: ["Tripoli", "Benghazi", "Misrata"] },
    { name: "Malaysia", cities: ["Kuala Lumpur", "George Town", "Johor Bahru", "Ipoh", "Shah Alam"] },
    { name: "Morocco", cities: ["Casablanca", "Rabat", "Marrakech", "Fez", "Tangier", "Agadir"] },
    { name: "Netherlands", cities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"] },
    { name: "Nigeria", cities: ["Lagos", "Abuja", "Kano", "Kaduna", "Ibadan"] },
    { name: "Oman", cities: ["Muscat", "Salalah", "Sohar", "Nizwa"] },
    { name: "Pakistan", cities: ["Karachi", "Lahore", "Islamabad", "Faisalabad", "Rawalpindi", "Multan", "Peshawar"] },
    { name: "Palestine", cities: ["Jerusalem", "Gaza", "Hebron", "Nablus", "Ramallah", "Bethlehem"] },
    { name: "Qatar", cities: ["Doha", "Al Wakrah", "Al Khor", "Al Rayyan"] },
    { name: "Russia", cities: ["Moscow", "Saint Petersburg", "Kazan", "Ufa", "Grozny"] },
    { name: "Saudi Arabia", cities: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Taif", "Tabuk"] },
    { name: "Singapore", cities: ["Singapore"] },
    { name: "Somalia", cities: ["Mogadishu", "Hargeisa", "Bosaso"] },
    { name: "South Africa", cities: ["Johannesburg", "Cape Town", "Durban", "Pretoria"] },
    { name: "Spain", cities: ["Madrid", "Barcelona", "Seville", "Granada", "Valencia"] },
    { name: "Sudan", cities: ["Khartoum", "Omdurman", "Port Sudan"] },
    { name: "Sweden", cities: ["Stockholm", "Gothenburg", "Malmo"] },
    { name: "Syria", cities: ["Damascus", "Aleppo", "Homs", "Latakia", "Hama"] },
    { name: "Tunisia", cities: ["Tunis", "Sfax", "Sousse", "Kairouan"] },
    { name: "Turkey", cities: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Konya", "Adana", "Gaziantep"] },
    { name: "United Arab Emirates", cities: ["Abu Dhabi", "Dubai", "Sharjah", "Al Ain", "Ajman", "Fujairah", "Ras Al Khaimah"] },
    { name: "United Kingdom", cities: ["London", "Birmingham", "Manchester", "Leeds", "Bradford", "Glasgow", "Liverpool"] },
    { name: "United States", cities: ["New York", "Los Angeles", "Chicago", "Houston", "Detroit", "Washington", "San Francisco", "Dallas", "Boston", "Atlanta"] },
    { name: "Uzbekistan", cities: ["Tashkent", "Samarkand", "Bukhara"] },
    { name: "Yemen", cities: ["Sanaa", "Aden", "Taiz", "Al Hudaydah"] }
];

export function citiesFor(countryName) {
    return COUNTRIES.find((c) => c.name === countryName)?.cities ?? [];
}
