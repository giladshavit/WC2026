# PostgreSQL — בדיקת bulk scoring מקומית

## אפשרות 1: Docker (מומלץ)

```bash
# מהשורש של הפרויקט
docker compose up -d

# התקן את psycopg2
cd backend && pip install psycopg2-binary

# הרץ את השרת עם PostgreSQL
DATABASE_URL=postgresql://predicto:predicto@localhost:5432/predicto python -m main
# או: export DATABASE_URL=... ואז uvicorn main:app --reload --host 0.0.0.0
```

**חשוב:** צריך ליצור את הטבלאות לפני השימוש. אם יש לך migration scripts, הרץ אותם. אחרת, SQLAlchemy ייצור את הטבלאות אוטומטית ב-first run.

## אפשרות 2: Homebrew (Mac)

אם Homebrew לא מתקין בגלל הרשאות, הרץ קודם:

```bash
sudo chown -R $(whoami) /opt/homebrew /opt/homebrew/Cellar /opt/homebrew/var/homebrew
```

ואז:

```bash
brew install postgresql@16
brew services start postgresql@16

# צור DB
createdb predicto

# או עם משתמש
psql postgres -c "CREATE USER predicto WITH PASSWORD 'predicto' CREATEDB;"
psql postgres -c "CREATE DATABASE predicto OWNER predicto;"
```

ואז:

```bash
export DATABASE_URL=postgresql://predicto:predicto@localhost:5432/predicto
cd backend && uvicorn main:app --reload --host 0.0.0.0
```

## אפשרות 3: Neon / Supabase (חינמי)

1. צור חשבון ב-[neon.tech](https://neon.tech) או [supabase.com](https://supabase.com)
2. צור DB חדש
3. העתק את ה-connection string
4. `export DATABASE_URL="postgresql://..."`

## העתקת נתונים מ-SQLite

אם יש לך נתונים ב-SQLite ורוצה להעביר ל-PostgreSQL, אפשר להשתמש ב-pgloader או לכתוב סקריפט מיגרציה. לבדיקת bulk בלבד — מספיק DB ריק עם הטבלאות.
