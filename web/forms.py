from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserCreationForm

User = get_user_model()


class RegisterForm(UserCreationForm):
    """Registration on the website: username, optional email, password twice."""
    email = forms.EmailField(label='Email (необязательно)', required=False)

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ['username', 'email']

    def clean_email(self):
        email = self.cleaned_data.get('email', '')
        if email and User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('Пользователь с таким email уже существует.')
        return email
