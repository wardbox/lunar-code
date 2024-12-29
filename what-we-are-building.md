# Build Plan for Lunar/Weather-Based GitHub Commit Stats SPA

Below is a step-by-step instruction guide to build a Next.js application hosted on Vercel. The app will allow users to sign in with GitHub OAuth and display statistics related to commit frequency during various lunar phases and weather conditions. If the user’s GitHub profile does not have a valid location, we will fallback to a default location.

---

## 1. Project Setup

1. **Initialize Next.js Project**  
   - Use create-next-app (or similar) to scaffold:
     ```bash
     npx create-next-app lunar-stats-app
     ```

2. **Install Libraries**  
   - Likely needed dependencies:
     - NextAuth (for GitHub OAuth)
     - Axios or similar for API calls
     - date-fns or luxon for date handling (optional, but can be handy)
     - A library for fetching weather data (e.g., OpenWeatherMap API calls)
     - A library or custom logic for lunar phase calculations (there are some existing libs, or can code custom)

3. **Project Structure**  
   - Provide a clear structure of your Next.js pages and components:
     ```
     pages/
       api/
         auth/[...nextauth].ts      // NextAuth setup
         commits.js                 // Endpoint for commits data
         weather.js                 // Endpoint for weather data
       index.js                     // Landing page
       profile.js                   // Profile and stats page
     components/
       Layout.js                    // Layout wrapper
       LunarStats.js                // Lunar stats section
       WeatherStats.js              // Weather stats section
     lib/
       getLunarPhase.js            // Utility to compute lunar phase
       fetchCommits.js             // Utility to fetch commits
       fetchWeather.js             // Utility to fetch weather
     ...
     ```

---

## 2. GitHub OAuth

1. **Set up NextAuth**  
   - Configure GitHub OAuth in NextAuth:
     ```typescript:pages/api/auth/[...nextauth].ts
     import NextAuth from "next-auth";
     import GithubProvider from "next-auth/providers/github";

     export default NextAuth({
       providers: [
         GithubProvider({
           clientId: process.env.GITHUB_ID!,
           clientSecret: process.env.GITHUB_SECRET!,
         }),
       ],
       callbacks: {
         async jwt({ token, account }) {
           if (account) {
             token.accessToken = account.access_token;
           }
           return token;
         },
         async session({ session, token }) {
           if (token.accessToken) {
             session.accessToken = token.accessToken;
           }
           return session;
         },
       },
     });
     ```
   - Store `GITHUB_ID` and `GITHUB_SECRET` in environment variables (in .env).

2. **Protect Routes**  
   - Use NextAuth’s `getSession` or `useSession` to ensure only authenticated users can access profile pages.

---

## 3. Fetching Commit Data

1. **Gather User’s Commits from GitHub**  
   - Once the user authenticates, retrieve their username and access token from the session.
   - Call GitHub’s REST or GraphQL API to fetch commit data.  
   - Plan how far back you want to retrieve commits (e.g, last year, last 100 commits, etc.).

2. **Store or Process Commits**  
   - Decide if you need to store commit data (e.g., in a local or hosted database like PostgreSQL, MongoDB) or simply process on the fly.  
   - For a small demo, you might process them directly after each login. But for efficiency and concurrency, consider caching or storing the data.

3. **Compute Lunar Phase per Commit**  
   - Based on each commit’s date and time, compute the lunar phase:
     ```typescript:lib/getLunarPhase.js
     // Pseudocode for computing lunar phase from a date
     export function getLunarPhase(date) {
       // Convert the commit date to the days from some epoch
       // Calculate the moon cycle index
       // Return which phase it belongs to
     }
     ```
   - Aggregate commit counts by lunar phase.

---

## 4. Integrating Weather Data

1. **Determine Location**  
   - If the user’s GitHub profile location exists, use that. Otherwise, default to a fallback (e.g., “San Francisco, CA” or “New York, NY”).
   
2. **Fetch Weather Data**  
   - If you want to track weather historically, it can be tricky. You may choose to provide general weather info for the user’s city (today’s weather, or a forecast).  
   - Alternatively, for a more robust approach (historical weather per commit date), you would need a historical weather API that can be expensive or have limited data.  
   - For demo purposes, maybe show a metric like: “Your city is known to have X rainy days per year, so you might have a Y% chance of committing on a rainy day.”

3. **API Integration**  
   ```typescript:lib/fetchWeather.js
   import axios from "axios";

   export async function fetchWeather(city) {
     const apiKey = process.env.WEATHER_API_KEY;
     const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`;
     const { data } = await axios.get(url);
     return data;
   }
   ```
   - Parse the relevant weather info to display.

---

## 5. Building the Stats Logic

1. **Combine Lunar Phase Data and Weather Data**  
   - Summarize commit frequencies by lunar phase.
   - Summarize the likelihood of different weather patterns in the user’s city.
   - Optionally, correlate commit data and weather if you have historical weather data.

2. **Tagline or “Profile”**  
   - For example:
     - If user has most commits on “Waxing Gibbous”, show a custom tagline:  
       “You’re a Waxing Gibbous Coder! You get inspired during times of growth and excitement, harness that momentum for your coding sessions!”

3. **Compute a Weather-Based Stat**  
   - For instance: “You commit 35% more on rainy days” (this can be a hypothetical ratio or a sample calculation if historical correlation is not truly computed).

---

## 6. Building the UI (Next.js Pages/Components)

1. **Landing Page (pages/index.js)**  
   - Brief introduction and a “Sign In with GitHub” button (using NextAuth’s signIn).

2. **Profile Page (pages/profile.js)**  
   - Protected route requiring GitHub login (use `getServerSideProps` with `getSession` or a client-side check with `useSession`).  
   - Displays:
     - GitHub username & avatar.
     - Commit count by lunar phase (maybe a bar chart or pie chart).
     - Custom tagline based on top lunar phase.
     - Weather data for their location or fallback.

3. **Lunar Stats Component**  
   ```jsx:components/LunarStats.js
   import React from "react";

   const LunarStats = ({ lunarData }) => {
     // lunarData is an object mapping phases to commit counts
     return (
       <section>
         <h2>Lunar Stats</h2>
         {/* Show a chart or a simple table */}
       </section>
     );
   };

   export default LunarStats;
   ```

4. **Weather Stats Component**  
   ```jsx:components/WeatherStats.js
   import React from "react";

   const WeatherStats = ({ weatherData }) => {
     // weatherData might have current temp, conditions, etc.
     return (
       <section>
         <h2>Weather Stats</h2>
         {/* Display city, temperature, conditions */}
       </section>
     );
   };

   export default WeatherStats;
   ```

5. **Styling**  
   - Use your preferred approach: CSS Modules, styled-components, Tailwind CSS, or default global CSS with Next.js.

---

## 7. Deployment on Vercel

1. **Connect to GitHub/Repo**  
   - Push your project to GitHub, then connect the repo to Vercel.

2. **Environment Variables**  
   - In your Vercel project settings, set the environment variables (e.g., `GITHUB_ID`, `GITHUB_SECRET`, `WEATHER_API_KEY`) so they match those in your `.env` file.

3. **Build & Test**  
   - Let Vercel build your Next.js project automatically.
   - Verify the OAuth flow and that the app correctly fetches data.

---

## 8. Potential Enhancements

1. **Database for Historical Commits**  
   - Store monthly or weekly snapshots of commits to get long-term charts.

2. **Deeper Weather Integration**  
   - Use historical weather logs to truly correlate weather conditions with commit volume.

3. **More Detailed Lunar Data**  
   - Expand beyond the main phases to more granular phases (like “new moon plus 1 day”).

4. **Social Sharing**  
   - Offer shareable images or stats so users can share their “lunar stats profile” on social platforms.

---

## 9. Summary

Following this plan will allow you to build a Next.js app that:  
1. Authenticates users via GitHub OAuth.  
2. Gathers user commit data and correlates it with lunar phases (and optionally weather patterns).  
3. Displays a fun “lunar profile” with personalized messaging based on the user’s commit distribution.  
4. Deploys simply and effectively to Vercel, leveraging Next.js built-in routes and serverless API endpoints.

Enjoy building your SPA that reveals intriguing connections between coding, the moon, and the weather!
