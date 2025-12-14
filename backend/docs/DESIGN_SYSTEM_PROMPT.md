# Design System Prompt for Microservices

## מערכת העיצוב של Content Studio - פרומפט לשימוש במיקרו-שירותים

### 1. צבעים (Colors)

#### Light Mode (יום)
- **Background Primary**: `#f8fafc` - רקע ראשי של הדף
- **Background Secondary**: `#e2e8f0` - רקע של סעיפים
- **Background Tertiary**: `#cbd5e1` - רקע של כרטיסים/תיבות
- **Background Card**: `#ffffff` - רקע של כרטיסים ראשיים (לבן)
- **Text Primary**: `#1e293b` - טקסט ראשי
- **Text Secondary**: `#475569` - טקסט משני
- **Text Muted**: `#64748b` - טקסט מושתק
- **Border Default**: `#e2e8f0` - גבול ברירת מחדל
- **Border Subtle**: `#f1f5f9` - גבול עדין
- **Border Strong**: `#cbd5e1` - גבול חזק

#### Dark Mode (לילה)
- **Background Primary**: `#0f172a` - רקע ראשי של הדף (כחול כהה עמוק)
- **Background Secondary**: `#1e293b` - רקע של פאנלים וסעיפים
- **Background Tertiary**: `#334155` - רקע של משטחי כרטיסים
- **Background Card**: `#1e293b` - רקע של כרטיסים ומיכלים
- **Text Primary**: `#f8fafc` - טקסט ראשי
- **Text Secondary**: `#cbd5e1` - טקסט משני
- **Text Muted**: `#94a3b8` - טקסט מושתק
- **Border Default**: `#334155` - גבול ברירת מחדל
- **Border Subtle**: `#1e293b` - גבול עדין
- **Border Strong**: `#475569` - גבול חזק

#### Brand Colors (שני המצבים)
- **Primary Emerald**: `#047857` (light) / `#0d9488` (dark)
- **Secondary Emerald**: `#065f46` (light) / `#059669` (dark)
- **Accent Gold**: `#d97706` / `#f59e0b`
- **Success**: `#10b981` (light) / `#34d399` (dark)
- **Warning**: `#f59e0b` (light) / `#fbbf24` (dark)
- **Error**: `#ef4444` (light) / `#f87171` (dark)
- **Info**: `#3b82f6` (light) / `#60a5fa` (dark)

#### Gradients
**Light Mode:**
- Primary: `linear-gradient(135deg, #065f46, #047857)`
- Secondary: `linear-gradient(135deg, #0f766e, #047857)`

- Card: `linear-gradient(145deg, #ffffff, #f0fdfa)`

**Dark Mode:**
- Primary: `linear-gradient(135deg, #0d9488, #059669)`
- Secondary: `linear-gradient(135deg, #14b8a6, #10b981)`

- Card: `linear-gradient(145deg, #1e293b, #334155)`

---

### 2. Font Family & Size

#### Font Families
- **Primary**: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **Secondary**: `'Space Grotesk', sans-serif`
- **Mono**: `'JetBrains Mono', 'Fira Code', 'Courier New', monospace`
- **Display**: `'Space Grotesk', sans-serif`

#### Font Sizes
- **xs**: `12px` / line-height: `16px` / letter-spacing: `0.01em`
- **sm**: `14px` / line-height: `20px` / letter-spacing: `0.01em`
- **base**: `16px` / line-height: `24px` / letter-spacing: `0`
- **lg**: `18px` / line-height: `28px` / letter-spacing: `-0.01em`
- **xl**: `20px` / line-height: `30px` / letter-spacing: `-0.01em`
- **2xl**: `24px` / line-height: `36px` / letter-spacing: `-0.02em`
- **3xl**: `30px` / line-height: `40px` / letter-spacing: `-0.02em`
- **4xl**: `36px` / line-height: `48px` / letter-spacing: `-0.03em`
- **5xl**: `48px` / line-height: `60px` / letter-spacing: `-0.03em`
- **6xl**: `60px` / line-height: `72px` / letter-spacing: `-0.04em`

#### Font Weights
- **light**: `300`
- **normal**: `400`
- **medium**: `500`
- **semibold**: `600`
- **bold**: `700`
- **extrabold**: `800`

---

### 3. Button Styles

#### Base Button Properties
- **Font Family**: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **Border Radius**: `8px` (rounded-lg)
- **Transition**: `all 200ms ease-in-out`
- **Focus Ring**: `2px solid` with offset `2px`
- **Active Scale**: `scale-95` (95% on click)

#### Button Sizes
- **Small**: `py-1.5 px-3` / `text-sm` (14px) / `line-height: 20px`
- **Medium**: `py-2.5 px-5` / `text-base` (16px) / `line-height: 24px`
- **Large**: `py-3.5 px-7` / `text-lg` (18px) / `line-height: 28px`

#### Button Variants

##### Primary Button
**Light Mode:**
- Background: `linear-gradient(to right, #047857, #059669)`
- Background Hover: `linear-gradient(to right, #059669, #047857)`
- Text: `#ffffff` (white)
- Shadow: `0 4px 6px -1px rgba(6, 95, 70, 0.2)`
- Shadow Hover: `0 10px 15px -3px rgba(6, 95, 70, 0.3)`
- Focus Ring: `#047857`

**Dark Mode:**
- Background: `linear-gradient(135deg, #0d9488, #059669)`
- Background Hover: `linear-gradient(135deg, #059669, #047857)`
- Text: `#ffffff` (white)
- Shadow: `0 4px 6px -1px rgba(13, 148, 136, 0.3), 0 0 15px rgba(13, 148, 136, 0.2)`
- Shadow Hover: `0 10px 15px -3px rgba(13, 148, 136, 0.4), 0 0 20px rgba(13, 148, 136, 0.3)`
- Focus Ring: `#0d9488`

**Tailwind Classes:**
```
bg-gradient-to-r from-emerald-600 to-emerald-700 
dark:from-emerald-600 dark:to-emerald-700 
text-white 
shadow-lg 
hover:from-emerald-700 hover:to-emerald-800 
dark:hover:from-emerald-700 dark:hover:to-emerald-800 
hover:shadow-xl 
active:scale-95 
focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
```

##### Secondary Button
**Light Mode:**
- Background: `transparent`
- Background Hover: `linear-gradient(to right, #047857, #059669)`
- Text: `#1e293b`
- Text Hover: `#ffffff`
- Border: `2px solid #cbd5e1`
- Border Hover: `transparent`

**Dark Mode:**
- Background: `transparent`
- Background Hover: `linear-gradient(135deg, #0d9488, #059669)`
- Text: `#f8fafc`
- Text Hover: `#ffffff`
- Border: `2px solid rgba(255, 255, 255, 0.2)`
- Border Hover: `transparent`

**Tailwind Classes:**
```
bg-transparent dark:bg-transparent 
text-gray-900 dark:text-[#f8fafc] 
border-2 border-gray-300 dark:border-white/20 
hover:bg-gradient-to-r hover:from-emerald-600 hover:to-emerald-700 
dark:hover:from-emerald-600 dark:hover:to-emerald-700 
hover:text-white hover:border-transparent 
active:scale-95 
focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
```

##### Ghost Button
**Light Mode:**
- Background: `transparent`
- Background Hover: `#f1f5f9`
- Text: `#475569`
- Text Hover: `#047857`

**Dark Mode:**
- Background: `transparent`
- Background Hover: `#334155`
- Text: `#cbd5e1`
- Text Hover: `#f8fafc`

**Tailwind Classes:**
```
bg-transparent dark:bg-transparent 
text-gray-700 dark:text-[#cbd5e1] 
hover:bg-gray-100 dark:hover:bg-[#334155] 
active:scale-95 
focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
```

##### Outline Button
**Light Mode:**
- Background: `transparent`
- Background Hover: `#f8fafc`
- Text: `#475569`
- Border: `1px solid #cbd5e1`

**Dark Mode:**
- Background: `transparent`
- Background Hover: `#334155`
- Text: `#f8fafc`
- Border: `1px solid rgba(255, 255, 255, 0.2)`

**Tailwind Classes:**
```
border border-gray-300 dark:border-white/20 
text-gray-700 dark:text-[#f8fafc] 
hover:bg-gray-50 dark:hover:bg-[#334155] 
active:scale-95 
focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
```

##### Danger Button
**Light Mode:**
- Background: `#ef4444`
- Background Hover: `#dc2626`
- Text: `#ffffff`
- Shadow: `0 4px 6px -1px rgba(239, 68, 68, 0.2)`
- Shadow Hover: `0 10px 15px -3px rgba(239, 68, 68, 0.3)`

**Dark Mode:**
- Background: `#dc2626`
- Background Hover: `#ef4444`
- Text: `#ffffff`
- Shadow: `0 4px 6px -1px rgba(220, 38, 38, 0.3), 0 0 15px rgba(220, 38, 38, 0.2)`
- Shadow Hover: `0 10px 15px -3px rgba(220, 38, 38, 0.4), 0 0 20px rgba(220, 38, 38, 0.3)`

**Tailwind Classes:**
```
bg-red-600 hover:bg-red-700 
text-white 
shadow-lg hover:shadow-xl 
active:scale-95 
focus:ring-2 focus:ring-red-500 focus:ring-offset-2
```

#### Disabled State (כל הווריאנטים)
- Opacity: `0.5`
- Cursor: `not-allowed`
- No hover effects

**Tailwind Classes:**
```
disabled:opacity-50 disabled:cursor-not-allowed
```

---

### 4. Shadows

#### Light Mode
- **Glow**: `0 0 30px rgba(6, 95, 70, 0.3)`
- **Card**: `0 10px 40px rgba(0, 0, 0, 0.1)`
- **Hover**: `0 20px 60px rgba(6, 95, 70, 0.2)`
- **Button**: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`

#### Dark Mode
- **Glow**: `0 0 30px rgba(13, 148, 136, 0.4)`
- **Card**: `0 10px 40px rgba(0, 0, 0, 0.6)`
- **Hover**: `0 20px 60px rgba(13, 148, 136, 0.3)`
- **Button**: `0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)`

---

### 5. Border Radius

- **xs**: `2px`
- **sm**: `4px`
- **md**: `6px`
- **lg**: `8px`
- **xl**: `12px`
- **2xl**: `16px`
- **3xl**: `20px`
- **4xl**: `24px`
- **full**: `9999px` (circular)

**Component Defaults:**
- Button: `md` (8px)
- Card: `lg` (8px)
- Input: `md` (8px)
- Modal: `xl` (12px)
- Badge/Chip: `full` (circular)

---

### 6. Spacing

- **xs**: `4px` (0.25rem)
- **sm**: `8px` (0.5rem)
- **md**: `16px` (1rem)
- **lg**: `24px` (1.5rem)
- **xl**: `32px` (2rem)
- **2xl**: `48px` (3rem)
- **3xl**: `64px` (4rem)
- **4xl**: `96px` (6rem)

---

### 7. Usage Example (React/Tailwind)

```jsx
// Primary Button
<button className="
  font-medium rounded-lg 
  bg-gradient-to-r from-emerald-600 to-emerald-700 
  dark:from-emerald-600 dark:to-emerald-700 
  text-white 
  py-2.5 px-5 
  shadow-lg 
  hover:from-emerald-700 hover:to-emerald-800 
  dark:hover:from-emerald-700 dark:hover:to-emerald-800 
  hover:shadow-xl 
  active:scale-95 
  transition-all duration-200 
  focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Click Me
</button>

// Secondary Button
<button className="
  font-medium rounded-lg 
  bg-transparent dark:bg-transparent 
  text-gray-900 dark:text-[#f8fafc] 
  border-2 border-gray-300 dark:border-white/20 
  py-2.5 px-5 
  hover:bg-gradient-to-r hover:from-emerald-600 hover:to-emerald-700 
  dark:hover:from-emerald-600 dark:hover:to-emerald-700 
  hover:text-white hover:border-transparent 
  active:scale-95 
  transition-all duration-200 
  focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Click Me
</button>
```

---

### 8. Important Notes

1. **Dark Mode**: כל הצבעים והסגנונות חייבים לתמוך ב-dark mode באמצעות `dark:` prefix ב-Tailwind
2. **Transitions**: כל אינטראקציות (hover, active, focus) חייבות transition של `200ms`
3. **Accessibility**: כל כפתורים חייבים focus ring עם `ring-2` ו-`ring-offset-2`
4. **Responsive**: Font sizes ו-spacing משתנים לפי breakpoints (mobile/tablet/desktop)
5. **Consistency**: יש להשתמש באותם ערכים בכל המיקרו-שירותים כדי לשמור על עקביות

---

### 9. Tailwind Config Reference

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Use design tokens from design-tokens.json
      },
      fontFamily: {
        primary: ['Inter', 'sans-serif'],
        secondary: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
}
```

---

**זהו הפרומפט המלא לשימוש במיקרו-שירותים. יש להשתמש בערכים אלה בדיוק כדי לשמור על עקביות עיצובית ברחבי המערכת.**

