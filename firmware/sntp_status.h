#pragma once
// SNTP の同期通知を自分で受け取るためのインクルード。
//
// ESPHome の on_time_sync は使えない。ESP32 では2つの経路から発火し、片方は
// sntp_component.cpp の loop で now().is_valid() を見るだけなので、deep sleep
// 復帰時の推定時刻（スリープ前の時刻＋スリープ時間）でも真になる。推定値には
// RTC のずれがそのまま乗っており、実機で10分ずらして確認したところ、補正前に
// 発火していた。
//
// esp_sntp_set_time_sync_notification_cb は ESP-IDF がサーバから応答を受け
// 取ったときにしか呼ばないので、曖昧さがない。
#include "esp_sntp.h"
