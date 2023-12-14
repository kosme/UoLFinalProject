from django.urls import path
from rest_framework.authtoken import views as auth_views
from . import views, api

urlpatterns = [
    path('', api.ping, name='ping'),
    path('data/', api.data, name='data'),
    path('data/<int:userId>', api.individualData, name='individual'),
    path('event/<int:userId>', api.event, name='event'),
    path('events/', api.events, name='events'),
    path('medical/', views.medical, name='medical'),
    path('api-token-auth/', auth_views.obtain_auth_token),
    path("login", views.login_request, name="login"),
    path("accounts/login/", views.login_request, name="login2"),
]
