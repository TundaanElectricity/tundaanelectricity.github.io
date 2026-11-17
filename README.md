# ⚡ TundraVolt: Tundaan Electricity System

The setup is the same as the Master Guide System: a **GitHub Pages** website with **Supabase** (free plan) as the database.

- **Mama (Admin):** sets the rate, adds the houses, enters the submeter readings every month, marks bills as paid, prints billing slips, and creates accounts.
- **Each house account:** can only see its **own** latest bill, unpaid balance, kWh chart, history and billing slips. Supabase security blocks it from seeing the other house.

Files:
- `index.html` is the whole website
- `supabase.sql` is the database setup

---

## 1. Create the Supabase project
1. Go to supabase.com → **New project** (free plan). Name it e.g. `tundaan-electricity`.
   *(The free plan allows 2 projects, so this can sit beside the Master Guide project.)*
2. Open **SQL Editor → New query**, paste everything from `supabase.sql`, and click **Run**.

## 2. Turn off email confirmation
**Authentication → Sign In / Providers → Email**, then turn **OFF** "Confirm email" and save.
(Usernames are turned into fake emails like `mama@tundaan-electric.app`. No real emails are sent.)

## 3. Create Mama's admin login
1. **Authentication → Users → Add user → Create new user**
   - Email: `mama@tundaan-electric.app`
   - Password: (choose one)
   - ✅ Auto Confirm User
2. Go back to **SQL Editor** and run:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Mama'
   where username = 'mama';
   ```
   Mama now logs in with username **mama** and that password.

## 4. Connect the website to Supabase
In Supabase: **Project Settings → API** (or **Data API / API Keys**). Copy:
- **Project URL**
- **anon / publishable key** (NOT the service_role / secret key)

Open `index.html` and paste them near the top of the script:
```js
const SUPABASE_URL      = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

## 5. Put it online with GitHub Pages
1. GitHub → **New repository**, named `tundaanelectricity.github.io` in the TundaanElectricity organization (Public)
2. **Add file → Upload files**, then upload `index.html` and commit.
3. **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main` / `(root)`, then Save.
4. After about a minute the site is live at `https://tundaanelectricity.github.io`

## 6. First use (Mama)
1. Log in as **mama**, then open **⚙️ Settings**
2. **Rate per kWh:** type the fixed rate (e.g. 13.50) and save
3. **Houses:** add both houses (e.g. *Ernie's House*, *Brother's House*), with the submeter number if you have one
4. **Accounts:** create an account for you and for your brother, and pick each person's house

## 7. Every month
1. **➕ Reading:** choose the house. The **previous reading fills in automatically** from last month. Type the **current reading**, and the bill (kWh × rate) shows right away. Save.
2. When the money is paid, go to **📜 History → ✅ Mark paid**
3. **🧾 Slip:** shows a billing slip you can print or screenshot to send

---

### Notes
- Changing the rate only affects **new** readings. Old bills keep the rate they were saved with.
- Only one reading per house per month. To fix a mistake, use **✏️ Edit**.
- Everyone can change their own password in the **☰ menu**. If someone forgets their password, reset it in Supabase → Authentication → Users.
- You can also make yourself an admin by choosing **Type: Admin** when creating your account.
- Free Supabase projects pause after about a week with no activity. Opening the site at least once a week keeps it awake. If it does pause, click **Restore** in the Supabase dashboard.

---

## 📲 App + 🔔 notifications (TundraVolt)
- `manifest.json`, `sw.js` and `icons/` make the site installable as the **TundraVolt** app (home screen icon, full screen).
- `supabase-notifications.sql` and `supabase/functions/notify-bill/` send a push notification and an icon badge to a house when Mama adds a new bill.
- The setup steps and secret keys are in the private file **TundraVolt-NOTIFICATIONS-SETUP.md**. That file is NOT in this repo, so keep it safe.
