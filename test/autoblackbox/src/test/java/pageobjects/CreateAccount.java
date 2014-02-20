package pageobjects;

import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selenide.$;

import org.openqa.selenium.By;

import java.util.Date;

public class CreateAccount {

    public static void createAcccountClick(){
        $(By.id("createAccount")).click();
    }

    public static void createAcccount(String firstName, String lastName, String company, String email, String login, String password, String password2) {
        $(byAttribute("name", "firstName")).sendKeys(firstName);
        $(byAttribute("name", "lastName")).sendKeys(lastName);
        $(byAttribute("name", "company")).sendKeys(company);
        $(byAttribute("name", "email")).sendKeys(email);
        $(byAttribute("name", "login")).sendKeys(login);
        $(byAttribute("name", "password")).sendKeys(password);
        $(byAttribute("name", "password2")).sendKeys(password2);
        createAcccountClick();
    }

    public static String createTestAccount() {
        Date date = new Date();
        long timestamp = date.getTime();
        String firstName = "autoGenerated";
        String lastName = "user" + timestamp;
        String company = "st";
        String email = lastName + "@silvertreesystems.com";
        String login = lastName;
        String password = lastName;
        String password2 = lastName;
        createAcccount(firstName, lastName, company, email, login, password, password2);
        return lastName;
    }
}