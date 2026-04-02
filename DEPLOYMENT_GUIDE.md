# Deployment Guide for NeuralV

This guide explains how to deploy your Node.js application to a production server (VPS) running Linux (typically Ubuntu).

## 1. Prerequisites
- A VPS (Virtual Private Server) from a provider like DigitalOcean, Linode, AWS, or similar.
- Access to the server via SSH.
- Your project files ready to be uploaded.

## 2. Server Setup (First Time Only)

Connect to your server via SSH:
```bash
ssh root@your_server_ip
```

### Install Node.js
We will install Node.js (version 18 or higher recommended).
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Install PM2 (Process Manager)
PM2 keeps your site running 24/7 and restarts it if it crashes.
```bash
npm install pm2 -g
```

## 3. Uploading Your Site

You can use an SFTP client (like FileZilla) to upload your project folder to the server.
Recommended path: `/var/www/neuralv`

**Important:** Do NOT upload the `node_modules` folder. It is huge and unnecessary. We will install dependencies on the server.

## 4. Starting the Application

Navigate to your project folder on the server:
```bash
cd /var/www/neuralv/backend
```

Install dependencies:
```bash
npm install
```

Start the server using PM2:
```bash
pm2 start server.js --name "neuralv-backend"
```

Save the process list so it restarts on reboot:
```bash
pm2 save
pm2 startup
```

## 5. Configuration (Automatic)

I have updated the code so it automatically detects if it's running on **NeuralV.net** or **Localhost**.
You don't need to manually change `db.js`.

## 6. Maintenance Commands

- **Restart Server:** `pm2 restart neuralv-backend`
- **Stop Server:** `pm2 stop neuralv-backend`
- **View Logs:** `pm2 logs`
- **Check Status:** `pm2 status`

## 7. Nginx Configuration (Recommended)

This configuration goes on your **Server (VPS)**, not in your project folder.

1.  **Install Nginx:**
    ```bash
    sudo apt install nginx -y
    ```

2.  **Create the configuration file:**
    ```bash
    sudo nano /etc/nginx/sites-available/neuralv
    ```

3.  **Paste the following code into that file:**

    ```nginx
    server {
        server_name neuralv.net www.neuralv.net;

        # Frontend (Static Files)
        location / {
            root /var/www/neuralv/site;
            index index.html;
            try_files $uri $uri/ =404;
        }

        # Backend API Proxy
        location /api/ {
            proxy_pass http://localhost:3000/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

4.  **Save & Exit:** Press `Ctrl+X`, then `Y`, then `Enter`.

5.  **Enable the site:**
    ```bash
    sudo ln -s /etc/nginx/sites-available/neuralv /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    ```

6.  **Add SSL (HTTPS):**
    ```bash
    sudo apt install certbot python3-certbot-nginx -y
    sudo certbot --nginx -d neuralv.net -d www.neuralv.net
    ```
