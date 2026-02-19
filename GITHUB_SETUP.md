# GitHub Repository Setup Komutları

## Mevcut Durum
Proje zaten GitHub'a bağlı:
- Repository: `git@github.com:aparialtech/kyradi-saas-canli.git`
- Remote: `origin`

## Yeni Proje İçin Setup (Eğer sıfırdan başlıyorsanız)

### Backend için:

```bash
# Backend klasörüne git
cd backend

# Git repository başlat
git init

# .gitignore dosyası oluştur (eğer yoksa)
cat > .gitignore << EOF
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
.env
.env.local
*.log
.DS_Store
EOF

# Dosyaları ekle
git add .

# İlk commit
git commit -m "Initial commit: Backend setup"

# GitHub repository oluştur (GitHub web'den veya GitHub CLI ile)
# Sonra remote ekle:
git remote add origin git@github.com:Aparialtech/kyradi-saas-canli-backend.git

# Push et
git branch -M main
git push -u origin main
```

### Frontend için:

```bash
# Frontend klasörüne git
cd frontend

# Git repository başlat
git init

# .gitignore dosyası oluştur (eğer yoksa)
cat > .gitignore << EOF
node_modules/
dist/
build/
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
*.log
.cache/
.parcel-cache/
.next/
out/
EOF

# Dosyaları ekle
git add .

# İlk commit
git commit -m "Initial commit: Frontend setup"

# GitHub repository oluştur (GitHub web'den veya GitHub CLI ile)
# Sonra remote ekle:
git remote add origin git@github.com:Aparialtech/kyradi-saas-canli-frontend.git

# Push et
git branch -M main
git push -u origin main
```

## Mevcut Monorepo İçin (Şu anki durum)

Proje zaten monorepo olarak GitHub'da:
- Repository: `git@github.com:aparialtech/kyradi-saas-canli.git`

### Mevcut durumu kontrol et:

```bash
# Proje root klasöründe
cd "/Users/suleyman/Desktop/Kyradi 2"

# Git durumunu kontrol et
git status

# Remote'ları kontrol et
git remote -v

# Branch'leri kontrol et
git branch -a

# Son commit'leri görüntüle
git log --oneline -10
```

### Yeni değişiklikleri push et:

```bash
# Değişiklikleri ekle
git add .

# Commit yap
git commit -m "Your commit message here"

# Push et
git push origin main
```

### Yeni branch oluştur:

```bash
# Yeni branch oluştur ve geçiş yap
git checkout -b feature/your-feature-name

# Değişiklikleri commit et
git add .
git commit -m "Feature: Your feature description"

# Branch'i GitHub'a push et
git push -u origin feature/your-feature-name
```

## GitHub CLI ile Repository Oluşturma (Alternatif)

Eğer GitHub CLI kuruluysa:

```bash
# GitHub CLI ile login ol
gh auth login

# Backend için repository oluştur
cd backend
gh repo create kyradi-saas-canli-backend --private --source=. --remote=origin --push

# Frontend için repository oluştur
cd ../frontend
gh repo create kyradi-saas-canli-frontend --private --source=. --remote=origin --push
```

## SSH Key Kontrolü

GitHub'a push yapabilmek için SSH key'inizin olması gerekiyor:

```bash
# SSH key kontrolü
ls -la ~/.ssh

# Eğer yoksa yeni SSH key oluştur
ssh-keygen -t ed25519 -C "your_email@example.com"

# SSH key'i GitHub'a ekle
cat ~/.ssh/id_ed25519.pub
# Bu çıktıyı GitHub Settings > SSH and GPG keys > New SSH key'a ekle
```

## Mevcut Repository Bilgileri

- **Repository URL**: `git@github.com:aparialtech/kyradi-saas-canli.git`
- **Kullanıcı**: Aparialtech
- **Repo Adı**: kyradi-saas-canli
- **Mevcut Durum**: Monorepo (backend ve frontend birlikte)

