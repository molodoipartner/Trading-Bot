import MetaTrader5 as mt5

terminal_path = r"C:\Program Files\MetaTrader 5\terminal64.exe"

LOGIN = 104258312
SERVER = "MetaQuotes-Demo"
PASSWORD = "2hTdGj_i"

if not mt5.initialize(
        path=terminal_path,
        login=LOGIN,
        password=PASSWORD,
        server=SERVER):

    print("Ошибка:", mt5.last_error())
    quit()

print("Подключение успешно")

account = mt5.account_info()
print("Аккаунт:", account.login)

mt5.shutdown()